import { Context, Probot } from 'probot';
import Generated from '@noqcks/generated';
import { minimatch } from 'minimatch';
import { PullRequest } from '@octokit/webhooks-types';

// Breaking change with v11: context.github has been removed. Use context.octokit instead
// https://github.com/probot/probot/releases/tag/v11.0.0

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

const log = (stuff) => {
	if (process.env.NODE_ENV === 'development') {
		console.log(stuff);
	}
};

/**
 * sizeLabel will return a string label that can be assigned to a
 * GitHub Pull Request. The label is determined by the lines of code
 * in the Pull Request.
 * @param lineCount The number of lines in the Pull Request.
 */
function sizeLabel(lineCount: number): Labels {
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
}

/**
 * getCustomGeneratedFiles will grab a list of file globs that determine
 * generated files from the repos .gitattributes.
 * @param context The context of the PullRequest.
 * @param owner The owner of the repository.
 * @param repo The repository where the .gitattributes file is located.
 */
async function getCustomGeneratedFiles(context: Context, owner: string, repo: string) {
	const path = '.gitattributes';
	try {
		// This should be typed better, but I couldn't find the right type to satisfy
		const { data }: any = await context.octokit.repos.getContent({ owner, repo, path });
		return Buffer.from(data.content, 'base64')
			.toString('ascii')
			.split('\n')
			.filter((item) => item.includes('linguist-generated=true') || item.includes('pr-size-ignore=true'))
			.map((item) => item.split(' ')[0]);
	} catch (e) {
		return [];
	}
}

/**
 * globMatch compares file name with file blobs to
 * see if a file is matched by a file glob expression.
 * @param file The file to compare.
 * @param globs A list of file globs to match the file.
 */
function globMatch(file: string, globs: string[]) {
	return globs.some((glob) => minimatch(file, glob));
}

async function ensureLabelExists(context: Context, name: Labels, color: Colors) {
	try {
		return await context.octokit.issues.getLabel(
			context.repo({
				name
			})
		);
	} catch (e) {
		return context.octokit.issues.createLabel(
			context.repo({
				name,
				color
			})
		);
	}
}

async function addLabel(context: Context, name: Labels, color: Colors) {
	const params = Object.assign({}, context.issue(), { labels: [name] });
	await ensureLabelExists(context, name, color);
	await context.octokit.issues.addLabels(params);
}

export = (app: Probot) => {
	app.on(
		['pull_request.opened', 'pull_request.reopened', 'pull_request.synchronize', 'pull_request.edited'],
		async (context: Context) => {
			const pullRequest: PullRequest = context.payload.pull_request;
			let { additions, deletions } = pullRequest;

			const {
				owner: { login: owner },
				name: repo
			} = pullRequest.base.repo;
			const { number } = pullRequest;
			log(`Pull request ${number} in ${repo}`);

			const fileData = await context.octokit.rest.pulls.listFiles({ owner, repo, pull_number: number });

			// get list of custom generated files as defined in .gitattributes
			const customGeneratedFiles = await getCustomGeneratedFiles(context, owner, repo);

			// if files are generated, remove them from the additions/deletions total
			fileData.data.forEach((item) => {
				var g = new Generated(item.filename, item.patch);
				if (globMatch(item.filename, customGeneratedFiles) || g.isGenerated()) {
					additions -= item.additions;
					deletions -= item.deletions;
				}
			});

			var labelToAdd: Labels = sizeLabel(additions + deletions);
			log(`Calculated labelToAdd: ${labelToAdd}`);

			// remove existing size/<size> label if it exists and is not labelToAdd
			pullRequest.labels.forEach((prLabel: { name: string }) => {
				log(`PR label: ${prLabel.name}`);
				log(`Labels: ${Object.values(Labels)}`);
				if (Object.values(Labels).toString().includes(prLabel.name)) {
					if (prLabel.name != labelToAdd) {
						log(`Removing label ${prLabel.name}`);
						context.octokit.issues.removeLabel(
							context.issue({
								name: prLabel.name
							})
						);
					}
				}
			});

			return await addLabel(context, labelToAdd, Colors[labelToAdd]);
		}
	);

	// TODO: This just here for sanity check. remove later
	app.on('issues.opened', async (context) => {
		const issueComment = context.issue({
			body: 'Thanks for opening this issue!'
		});
		await context.octokit.issues.createComment(issueComment);
	});

	// we don't care about marketplace events
	// TODO: do we actually? Might be nice to see
	app.on('marketplace_purchase', async () => {
		return;
	});
};
