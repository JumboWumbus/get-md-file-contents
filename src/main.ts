/* eslint-disable @typescript-eslint/no-non-null-assertion */

import path from 'path';
import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { PushEvent } from '@octokit/webhooks-definitions/schema';
import { AxiosError } from 'axios';
import { promises as fs } from 'fs';
import parseMD from 'parse-md';



type Github = ReturnType<typeof getOctokit>;

async function loadArticleFile(
   github: Github,
   folderName: string,
): Promise<{ fileName: string; content: string }> {
   const { owner, repo } = context.repo;
   // NOTE: Pagination returns 30 files by default
   const commit = (
      await github.request('GET /repos/{owner}/{repo}/commits/{ref}', {
         owner,
         repo,
         ref: context.sha,
      })
   ).data;
   const articleFileRegex = new RegExp(`${folderName}\/.*\.md`);
   const mdFiles = commit.files!.filter((f) => articleFileRegex.test(f.filename!));
   core.debug(`Found ${mdFiles.length} markdown files`);
   if (mdFiles.length == 0) {
      throw new Error('No markdown files found');
   }

   const newArticle = mdFiles[0];
   core.debug(`Using ${newArticle.filename!}`);
   const content = await fs.readFile(`./${newArticle.filename!}`, 'utf8');
   return { fileName: newArticle.filename!, content };
}

async function fileContentExists(github: Github, filePath: string, ref: string): Promise<boolean> {
   const { owner, repo } = context.repo;
   try {
      const res = await github.rest.repos.getContent({
         owner,
         repo,
         ref,
         path: filePath,
      });
      return res.status === 200;
   } catch (e) {
      return false;
   }
}

export async function run() {
   try {
      const ghToken = core.getInput('gh_token', { required: true });
      const articlesFolder = core.getInput('articles_folder', { required: false });

      const github = getOctokit(ghToken);

      const articleFile = await loadArticleFile(github, articlesFolder);
      const beforeCommit = (context.payload as PushEvent).before;
      const articleAlreadyExists = await fileContentExists(
         github,
         articleFile.fileName,
         beforeCommit,
      );
      if (articleAlreadyExists) {
         core.debug(`Article ${articleFile.fileName} already published. Skipping.`);
         return;
      }
      const rawGithubUrl = context.serverUrl.replace('//github.com', '//raw.githubusercontent.com');
      const { repo, owner } = context.repo;
      const branchName = context.ref.replace('refs/heads/', '');
      const fileUrl = `${rawGithubUrl}/${owner}/${repo}/${branchName}/${articleFile.fileName}`;
      const basePath = path.dirname(fileUrl).replace('https://', '');
      /* istanbul ignore next */
      core.debug(`Base path: ${basePath}`);
      core.debug(`File URL = ${fileUrl}`)

      const fileContent = fs.readFile(articleFile.content, 'utf8')
      const {metadata, content} = parseMD(await fileContent);

      core.debug(`Metadata found: ${metadata}`);
      core.debug(`Content found: ${content}`);

      core.setOutput('metadata', metadata);
      core.setOutput('content', content);


 
   } catch (err) {
      /* istanbul ignore next */
      {
         const axiosErr = err as AxiosError;
         if (axiosErr.response) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            
            core.debug(JSON.stringify(axiosErr.response.data));
            
         }
      }
      core.setFailed(err as Error);
   }
}