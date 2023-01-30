import Handlebars from 'handlebars';
import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { promises } from 'fs';

import { run } from '../src/main';


const octokitMock = {
   request: jest.fn(),
   rest: {
      repos: {
         getContent: jest.fn(),
      },
   },
};
jest.mock('fs', () => ({
   promises: {
      readFile: jest.fn(),
   },
}));
jest.mock('handlebars', () => ({
   compile: jest.fn(),
}));

jest.mock('@actions/github', () => ({
   context: {
      serverUrl: 'https://github.com',
      ref: 'refs/heads/main',
      repo: {
         owner: 'owner',
         repo: 'repo',
      },
      payload: {
         before: 'sha-before',
      },
      sha: 'commit-sha',
   },
   getOctokit: jest.fn(),
}));
jest.mock('@actions/core');

describe('get-latest-md-file', () => {
   beforeEach(jest.clearAllMocks);

   (getOctokit as jest.Mock).mockReturnValue(octokitMock);

   const fileData = {
      data: {
         files: [
            {
               filename: 'blogs/blog-01.md',
            },
         ],
      },
   };

   it('should fail if it fails to fetch commit info', async () => {
      const err = new Error('github');
      octokitMock.request.mockRejectedValue(err);

      await run();

      expect(octokitMock.request).toHaveBeenCalledWith('GET /repos/{owner}/{repo}/commits/{ref}', {
         owner: 'owner',
         repo: 'repo',
         ref: 'commit-sha',
      });
      expect(core.setFailed).toHaveBeenCalledWith(err);
   });

   it('should fail if no markdown files found', async () => {
      (core.getInput as jest.Mock).mockImplementation((key: string) => {
         return key === 'articles_folder' ? 'blogs' : '';
      });
      octokitMock.request.mockResolvedValue({
         data: {
            files: [
               {
                  filename: 'readme.txt',
               },
            ],
         },
      });

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(expect.any(Error));
      const err = (core.setFailed as jest.Mock).mock.calls[0][0] as Error;
      expect(err.message).toEqual('No markdown files found');
   });

   it('should fail if it fails to read article file', async () => {
      (core.getInput as jest.Mock).mockImplementation((key: string) => {
         return key === 'articles_folder' ? 'blogs' : '';
      });
      const err = new Error('fs');
      (promises.readFile as jest.Mock).mockRejectedValue(err);
      octokitMock.request.mockResolvedValue(fileData);

      await run();

      expect(promises.readFile).toHaveBeenCalledWith('./blogs/blog-01.md', 'utf8');
      expect(core.setFailed).toHaveBeenCalledWith(err);
   });

   it('should skip if file already exists in repository', async () => {
      (core.getInput as jest.Mock).mockImplementation((key: string) => {
         return key === 'articles_folder' ? 'blogs' : '';
      });
      (promises.readFile as jest.Mock).mockResolvedValue('content');
      octokitMock.request.mockResolvedValue(fileData);
      octokitMock.rest.repos.getContent.mockResolvedValue({
         status: 200,
      });

      await run();
   });
});