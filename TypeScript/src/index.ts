import { Command, Option } from 'commander';
import fs from 'fs';
import path from 'path';

import IncomingModelFile from './file-parser';


const name = path.basename(process.argv[1]);
const program = new Command();

program.description('Parses 3D model data from Incoming\'s .ian format.');
program.addOption(new Option('-e, --export <path>', '.ian file path (to convert to .obj)').conflicts('import'))
program.addOption(new Option('-i, --import <path>', '.obj file path (to convert to .ian)').conflicts('export'))
program.requiredOption('-o, --output <path>', 'Output path');
program.addHelpText('after', `
Example usage:
    >> ${name} --export lfighter.ian --output lfighter.obj
`);
program.parse(process.argv);

const options = program.opts();

if (!(options.export || options.import)) {
    console.error('error: --export or --import argument required');
    process.exit(1);
}

const inputPath = path.resolve(options.export || options.import);
const outputPath = path.resolve(options.output);

if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
}

const buffer = fs.readFileSync(inputPath);

if (options.export) {
    const incomingModel = new IncomingModelFile(buffer);
    const objData = incomingModel.toOBJ();
    fs.writeFileSync(outputPath, objData);
} else if (options.import) {
    // TODO
}
