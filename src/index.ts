import { Probot, ProbotOctokit } from 'probot';

export = (app: Probot) => {
	const octokit = new ProbotOctokit();
	app.on(['pull_request.opened', 'pull_request.reopened', 'pull_request.synchronize', 'pull_request.edited'], async (context) => {
		const pullRequest = context.payload.pull_request;
		const {
			owner: { login: owner },
			name: repo
		} = pullRequest.base.repo;
		const { number } = pullRequest;
		const { additions, deletions } = pullRequest;

		const fileData = await octokit.request(`GET /repos/${owner}/${repo}/pulls/${number}/files`, {
			owner,
			repo,
			number
		});
		const files = fileData.data.map((item: { filename: string }) => item.filename);
		console.log(`additions: ${additions}`);
		console.log(`deletions: ${deletions}`);
		console.log(files);
	});

	// TODO: This just here for sanity check. remove later
	app.on('issues.opened', async (context) => {
		const issueComment = context.issue({
			body: 'Thanks for opening this issue!'
		});
		await context.octokit.issues.createComment(issueComment);
	});
};
