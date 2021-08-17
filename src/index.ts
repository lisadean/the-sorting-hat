import * as core from '@actions/core';
import * as github from '@actions/github';
// TODO: maybe replace this with @actions/glob
import * as minimatch from 'minimatch';
import { Context } from '@actions/github/lib/context';
import { PullRequestEvent, Label } from '@octokit/webhooks-types';
import { GetResponseTypeFromEndpointMethod } from '@octokit/types';

type ClientType = ReturnType<typeof github.getOctokit>;
type GetContentResponseType = GetResponseTypeFromEndpointMethod<typeof client.rest.repos.getContent>;
type File = {
	sha: string;
	filename: string;
	status: string;
	additions: number;
	deletions: number;
	changes: number;
	blob_url: string;
	raw_url: string;
	contents_url: string;
	patch?: string;
	previous_filename?: string;
};

let context: Context;
const client: ClientType = github.getOctokit(core.getInput('token'));

enum Labels {
	XS = 'size/XS',
	S = 'size/S',
	M = 'size/M',
	L = 'size/L',
	XL = 'size/XL',
	XXL = 'size/XXL',
	SERVERONLY = 'server-only'
}

enum Colors {
	'size/XS' = '3CBF00',
	'size/S' = '5D9801',
	'size/M' = '7F7203',
	'size/L' = 'A14C05',
	'size/XL' = 'C32607',
	'size/XXL' = 'E50009',
	'server-only' = '66E5A2'
}

enum Sizes {
	XS = 0,
	S = 10,
	M = 30,
	L = 100,
	Xl = 500,
	Xxl = 1000
}

const info = (stuff: string) => core.info(stuff);
const error = (stuff: string | Error) => {
	if (typeof stuff !== 'string' && stuff.stack) {
		core.error(stuff.stack);
	} else {
		core.error(stuff);
	}
};

const globMatch = (file: string, globs: string[]) => globs.some((glob) => minimatch(file, glob));

/**
 * sizeLabel will return a string label that can be assigned to a
 * GitHub Pull Request. The label is determined by the lines of code
 * in the Pull Request.
 * @param lineCount The number of lines in the Pull Request.
 */
const sizeLabel = (lineCount: number) => {
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

const getExcludedFiles = async () => {
	const path = '.gitattributes';
	const exclusions = ['linguist-generated=true', 'pr-size-ignore=true'];
	try {
		// TODO: Can't figure out how to fix data.content ts warning without adding the any type
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data }: GetContentResponseType | any = await client.rest.repos.getContent({ ...github.context.repo, path });
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

const ensureLabelExists = async (name: string, color: Colors) => {
	try {
		return await client.rest.issues.getLabel({ ...github.context.repo, name });
	} catch (e) {
		return client.rest.issues.createLabel({ ...github.context.repo, name, color });
	}
};

const getSizeBasedLabels = async (changedLines: number, files: File[], labels: Label[]) => {
	let totalChangedLines = changedLines;
	let totalChangedLinesInExcludedFiles = 0;
	const excludedFiles = await getExcludedFiles();
	for (const file of files) {
		if (globMatch(file.filename, excludedFiles)) {
			info(`Excluding file: ${file.filename}`);
			totalChangedLines -= file.additions + file.deletions;
			totalChangedLinesInExcludedFiles += file.additions + file.deletions;
		}
	}

	info(`Total number of additions and deletions in non-excluded files: ${totalChangedLines}`);
	info(`Total number of additions and deletions in excluded files: ${totalChangedLinesInExcludedFiles}`);
	const labelToAdd = sizeLabel(totalChangedLines).toString();

	let labelsToRemove: Label[] = [];
	for (const prLabel of labels) {
		if (Object.values(Labels).toString().includes(prLabel.name)) {
			if (prLabel.name !== labelToAdd) {
				labelsToRemove.push(prLabel);
			}
		}
	}
	return { sizeLabelToAdd: [labelToAdd], sizeLabelsToRemove: labelsToRemove };
};

const getServerOnlyLabel = (files: File[], labels: Label[]) => {
	const serverOnlyPattern = '**/src/server/**';
	console.dir(`files: ${JSON.stringify(files, null, 2)}`);
	const serverOnly = files.some((file) => !minimatch(file.filename, serverOnlyPattern));
	if (serverOnly) {
		info('This PR is server only and has no UI changes');
	}
	const existingLabel = labels.find((label) => label.name === Labels.SERVERONLY);
	info(`existingLabel: ${JSON.stringify(existingLabel, null, 2)}`);
	const labelToAdd: string[] = serverOnly && !existingLabel ? [Labels.SERVERONLY] : [];
	const labelsToRemove: Label[] = !serverOnly && existingLabel ? [existingLabel] : [];
	info(`labelToAd: ${labelToAdd} labelsToRemove: ${labelsToRemove}`);
	return { serverOnlyLabelToAdd: labelToAdd, serverOnlyLabelToRemove: labelsToRemove };
};

const handlePullRequest = async () => {
	const {
		pull_request: { number, title, labels: prLabels, additions, deletions }
	}: PullRequestEvent = context.payload as PullRequestEvent;
	info(`Processing pull request #${number}: ${title} in ${context.repo.repo}`);

	const labelsToAdd: string[] = [];
	const labelsToRemove: Label[] = [];
	const { data: prFiles } = await client.rest.pulls.listFiles({ ...context.repo, pull_number: number });

	const { sizeLabelToAdd, sizeLabelsToRemove } = await getSizeBasedLabels(additions + deletions, prFiles, prLabels);
	labelsToAdd.concat(sizeLabelToAdd);
	labelsToRemove.concat(sizeLabelsToRemove);

	const { serverOnlyLabelToAdd, serverOnlyLabelToRemove } = getServerOnlyLabel(prFiles, prLabels);
	labelsToAdd.concat(serverOnlyLabelToAdd);
	labelsToRemove.concat(serverOnlyLabelToRemove);

	info(`labels to add: ${labelsToAdd}`);
	info(`labels to remove: ${labelsToRemove}`);

	for (const label of labelsToRemove) {
		info(`Removing label ${label.name}`);
		await client.rest.issues.removeLabel({
			...context.repo,
			issue_number: number,
			name: label.name
		});
	}

	info(`Adding label: ${labelsToAdd}`);
	for (const label of labelsToAdd) {
		await ensureLabelExists(label, Colors[label]);
	}
	return await client.rest.issues.addLabels({ ...context.repo, issue_number: number, labels: labelsToAdd });
};

const run = async () => {
	try {
		context = github.context;
		if (context.eventName === 'pull_request') {
			await handlePullRequest();
		} else {
			return core.warning('No relevant event found');
		}
	} catch (e) {
		error(e);
		return core.setFailed('Something went wrong');
	}
};

run();
