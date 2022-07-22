#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { batchTranscode } from './batch-transcode.js';

const argv = yargs(hideBin(process.argv))
 .option('concurrency', {
    alias: 'c',
    type: 'number',
    description: 'Number of concurrent jobs'
  })
  .option('ffmpeg', {
    alias: 'f',
    type: 'string',
    description: 'Path to ffmpeg binary'
  })
  .option('transcode', {
    alias: 't',
    type: 'boolean',
    description: 'Whether video stream should be transcoded'
  }).argv

const { _:[inputDir, outputDir], transcode: fullTranscode, concurrency, ffmpeg: ffmpegPath } = argv;

(async function(){
    if (!outputDir) throw new Error('No output directory specified')
    if (ffmpegPath) {
        process.env.FFMPEG_BIN_PATH = ffmpegPath
    }
    console.log('Scanning for mkv files in', inputDir, 'outputting to', outputDir);

    const { transcodedFiles } = await batchTranscode(inputDir, outputDir, fullTranscode, concurrency);

    console.log(`Done ${fullTranscode ? 'transcoding' : 're-muxing'}`, Object.keys(transcodedFiles).length, 'files');
})();