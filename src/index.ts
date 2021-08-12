import core from '@actions/core';
import github from '@actions/github';
import Generated from '@noqcks/generated';
import { minimatch } from 'minimatch';
import { PullRequestEvent } from '@octokit/webhooks-types';
import { Context } from '@actions/github/lib/context';

type ClientType = ReturnType<typeof github.getOctokit>;

enum Labels {
	XS = 'size/XS',
	S = 'size/S',
	M = 'size/M',
	L = 'size/L',
	XL = 'size/XL',
	XXL = 'size/XXL'
}

enum Colors {
	'size/XS' = '3CBF00',
	'size/S' = '5D9801',
	'size/M' = '7F7203',
	'size/L' = 'A14C05',
	'size/XL' = 'C32607',
	'size/XXL' = 'E50009'
}

enum Sizes {
	S = 10,
	M = 30,
	L = 100,
	Xl = 500,
	Xxl = 1000
}

const info = (stuff: string) => {
	// eslint-disable-next-line no-console
	console.info(stuff);
	core.info(stuff);
};
const error = (stuff: string | Error) => {
	// eslint-disable-next-line no-console
	console.error(stuff);
	core.error(stuff);
};
const debug = (stuff: string) => {
	// eslint-disable-next-line no-console
	process.env.NODE_ENV === 'development' && console.debug(stuff);
	core.debug(stuff);
};
const globMatch = (file: string, globs: string[]) => globs.some((glob) => minimatch(file, glob));

/**
 * sizeLabel will return a string label that can be assigned to a
 * GitHub Pull Request. The label is determined by the lines of code
 * in the Pull Request.
 * @param lineCount The number of lines in the Pull Request.
 */
const sizeLabel = (lineCount: number): Labels => {
	if (lineCount < Sizes.S) {
		return Labels.XS;
	} else if (lineCount < Sizes.M) {
		return Labels.S;
	} else if (lineCount < Sizes.L) {
		return Labels.M;
	} else if (lineCount < Sizes.Xl) {
		return Labels.L;
	} else if (lineCount < Sizes.Xxl) {
		return Labels.XL;
	}
	return Labels.XXL;
};

const getExcludedFiles = async (client: ClientType) => {
	const path = '.gitattributes';
	const exclusions = ['linguist-generated=true', 'pr-size-ignore=true'];
	try {
		// There might be a type for this somewhere
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data }: any = await client.rest.repos.getContent({ ...github.context.repo, path });
		const excludedFiles = data.content
			? Buffer.from(data.content, 'base64')
					.toString('ascii')
					.split('\n')
					.filter((item) => exclusions.some((exclusion) => item.includes(exclusion)))
					.map((item) => item.split(' ')[0])
			: [];
		excludedFiles.length > 0 ? info(`Custom file exclusions found: ${excludedFiles}`) : info('No custom file exclusions found');
		return excludedFiles;
	} catch (e) {
		return [];
	}
};

const ensureLabelExists = async (client: ClientType, name: Labels, color: Colors) => {
	try {
		return await client.rest.issues.getLabel({ ...github.context.repo, name });
	} catch (e) {
		return client.rest.issues.createLabel({ ...github.context.repo, name, color });
	}
};

const handlePullRequest = async (context: Context) => {
	const client: ClientType = github.getOctokit(core.getInput('token'));

	const {
		pull_request: { number },
		pull_request: pullRequest
	}: PullRequestEvent = context.payload as PullRequestEvent;

	let { additions, deletions } = pullRequest;
	info(`Processing pull request ${number} in ${context.repo.repo}`);

	const fileData = await client.rest.pulls.listFiles({ ...context.repo, pull_number: number });
	const excludedFiles = await getExcludedFiles(client);

	// if files are excluded, remove them from the additions/deletions total
	for (const file of fileData.data) {
		const g = new Generated(file.filename, file.patch);
		if (globMatch(file.filename, excludedFiles) || g.isGenerated()) {
			info(`Excluding file: ${file.filename}`);
			additions -= file.additions;
			deletions -= file.deletions;
		}
	}
	const totalChangedLines = additions + deletions;
	const labelToAdd: Labels = sizeLabel(totalChangedLines);
	info(`Total number of additions and deletions in non-excluded files: ${totalChangedLines}`);

	// remove old size/<size> label if it no longer applies
	for (const prLabel of pullRequest.labels) {
		debug(`PR label: ${prLabel.name}`);
		debug(`Labels: ${Object.values(Labels)}`);
		if (Object.values(Labels).toString().includes(prLabel.name)) {
			if (prLabel.name !== labelToAdd) {
				info(`Removing label ${prLabel.name}`);
				await client.rest.issues.removeLabel({
					...context.repo,
					issue_number: number,
					name: prLabel.name
				});
			}
		}
	}

	// Add label
	await ensureLabelExists(client, labelToAdd, Colors[labelToAdd]);
	info(`Adding label: ${labelToAdd}`);
	return await client.rest.issues.addLabels({ ...context.repo, issue_number: number, labels: [labelToAdd] });
};

const run = async () => {
	try {
		const context = github.context;
		if (context.eventName === 'pull_request') {
			handlePullRequest(context);
		} else {
			return core.warning('No relevant event found');
		}
	} catch (e) {
		error(e.message);
		return core.setFailed(e.message);
	}
};

run();
