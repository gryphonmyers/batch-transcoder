#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { batchTranscode } from './batch-transcode.js';

const argv = yargs(hideBin(process.argv)).argv

const { _:[inputDir, outputDir, concurrency, ffmpegPath] } = argv;

(async function(){
    if (!outputDir) throw new Error('No output directory specified')
    if (ffmpegPath) {
        process.env.FFMPEG_BIN_PATH = ffmpegPath
    }
    console.log('Scanning for mkv files in', inputDir, 'outputting to', outputDir);

    const { transcodedFiles } = await batchTranscode(inputDir, outputDir, concurrency);

    console.log('Done transcoding', Object.keys(transcodedFiles).length, 'files');
})();