import os from 'os';
import path, { dirname } from 'path';
import { mkdir, readdir, stat, access } from "fs/promises";
import { createReadStream, createWriteStream, constants } from 'fs';
import PQueue from 'p-queue';
import Transcoder from "stream-transcoder";

async function transcodeMkvFile(pathArr, outputRootDir, fullTranscode) {
    const inputFilePath = path.join(...pathArr);
    const inputFileOutputPath = path.join(...[outputRootDir, ...pathArr.slice(1)]);
    const parsed = path.parse(inputFileOutputPath);
    const outputFilePath = path.format({ dir: parsed.dir, name: parsed.name, ext: '.mp4' });
    const outputDir = dirname(outputFilePath);

    let doesExist = false;
    
    try {
        await access(outputFilePath, constants.F_OK)
        doesExist = true;
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err
        }
    }

    if (doesExist) {
        console.log(outputFilePath, 'already exists. Skipping');
        return { inputFilePath, outputFilePath, didTranscode: false }
    }

    let dirDoesExist = false;

    try {
        await access(outputDir, constants.F_OK)
        dirDoesExist = true;
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err
        }
    }

    if (!dirDoesExist) {
        await mkdir(outputDir, { recursive: true });
    }

    console.log(`${fullTranscode ? 'Transcoding' : 'Re-muxing'} mkv file`, inputFilePath, 'to', outputFilePath);
    
    await new Promise((resolve, reject) => {
        const inputStream = createReadStream(inputFilePath);
        const outputStream = createWriteStream(outputFilePath);

        new Transcoder(inputStream)
            .videoCodec(fullTranscode ? 'h264' : 'copy')
            .format('mp4')
            // .custom('-movflags','+faststart')
            .on('finish', function() {    
                resolve()
            })
            .on('error', error => {
                reject(new Error(`Error while processing video file ${inputFilePath}: ${error}`))
            })
            .stream().pipe(outputStream);
    })
    
    return { inputFilePath, outputFilePath, didTranscode: true }
}

async function getMkvTranscodeCbsInDir(inputDir, outputDir, fullTranscode=false, transcodedFiles={}) {
    const inputArr = Array.isArray(inputDir) ? inputDir : [inputDir];
    const inputPath = path.join(...inputArr)

    const files = await readdir(inputPath);

    let transcodeJobs = []

    await Promise.all(files.map(async file => {
        const filePath = path.join(inputPath, file);
        const stats = await stat(filePath);

        if (stats.isDirectory()) {
            
            const { transcodeJobs: currTranscodeJobs } = await getMkvTranscodeCbsInDir([...inputArr, file], outputDir, fullTranscode, transcodedFiles)

            transcodeJobs = transcodeJobs.concat(currTranscodeJobs)

        } else if (path.extname(file) == '.mkv') {
            transcodeJobs.push(async () => {
                const { inputFilePath, outputFilePath, didTranscode } = await transcodeMkvFile([...inputArr, file], outputDir, fullTranscode)
                
                if (didTranscode) {
                    Object.assign(transcodedFiles, { [inputFilePath]: outputFilePath });
                }
            })
        }
    }))

    return { transcodedFiles, transcodeJobs }
}

export async function batchTranscode(inputDir, outputDir, fullTranscode=false, concurrency=os.cpus().length) {

    const { transcodedFiles, transcodeJobs } = await getMkvTranscodeCbsInDir(inputDir, outputDir, fullTranscode);

    console.log('Queueing', transcodeJobs.length, `${fullTranscode ? 'transcode' : 're-mux'} jobs with concurrency of`, concurrency);

    const queue = new PQueue({ concurrency });

    await queue.addAll(transcodeJobs)

    return { transcodedFiles };
}