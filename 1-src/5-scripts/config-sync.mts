import fs from 'fs';
import path from 'path';
const __dirname = path.resolve();

/***************************************
* Sync Configurations Inputs and Types *
* Note: Run via '.mjs' counterpart     *
****************************************/
//Path of /server repository root | (relative to where script executed)
const SERVER_ROOT:string = path.resolve(__dirname);

//Path to TS /field-sync | (relative to where script executed)
const SOURCE_DIRECTORY:string = path.resolve(__dirname, '1-src/0-assets/field-sync');

//Portal and Mobile Repository path from SERVER_ROOT
type TargetConfig = { relativePath:string, importExtension:string, fileExtension:string }
const targetConfigurations: TargetConfig[] = [
    {
        relativePath: '../portal/src/0-Assets/field-sync',
        importExtension: '',
        fileExtension: '.ts'
    },
    {
        relativePath: '../mobile/src/TypesAndInterfaces/config-sync',
        importExtension: '',
        fileExtension: '.ts'
    }
];


const importRegex:RegExp = new RegExp(/import\s+(?:[\s\S]*?)\s+from\s+['"](.*)['"]/g);

//Recursively identify all file paths
const collectPaths = (directory: string): string[] =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((subDirectory) => {
        const fullPath = path.join(directory, subDirectory.name);
        return subDirectory.isDirectory() ? collectPaths(fullPath) : [fullPath];
    });


const updateImportExtensions = (content: string, config: TargetConfig):string => {
    let newContent:string = content
    for(const match of content.matchAll(importRegex)) {
        const existingImportPath:string = match[1];
        const newImportPath:string = match[1].replace('.mjs', config.importExtension)
        newContent = newContent.replace(existingImportPath, newImportPath);
    }
    return newContent
};


//Enforce no external imports outside of '/field-sync'
const validateImports = (content:string, filePath:string, sourceDir:string) => {
    const fileDir:string = path.dirname(filePath);

    for(const match of content.matchAll(importRegex)) {
        const importPath = match[1];

        //Must stay inside /field-sync/
        const resolvedImportPath:string = path.resolve(sourceDir, fileDir, importPath);
        const relativeToSourcePath:string = path.relative(sourceDir, resolvedImportPath);
        if(relativeToSourcePath.startsWith('..'))
            throw new Error(`Outside field-sync/ imports are not permitted: \nInside: ${filePath} \n${importPath}`);

        //Disallow absolute or package imports
        if(!importPath.startsWith('.'))
            throw new Error(`Package imports are not permitted: \nInside: ${filePath} \n${importPath}`);
    }
}


/* CLEAR TARGET DIRECTORIES | (Server source of truth) */
targetConfigurations.forEach((config) => {
    const destDir = path.resolve(SERVER_ROOT, config.relativePath);
    if(fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
      console.log(`Cleared: ${destDir}`);
    }
    fs.mkdirSync(destDir, { recursive: true });
  });

/* MAIN COPY EXECUTION */
collectPaths(SOURCE_DIRECTORY).forEach((filePath) => {
    const relPath = path.relative(SOURCE_DIRECTORY, filePath);
    const raw = fs.readFileSync(filePath, 'utf8');

    validateImports(raw, filePath, SOURCE_DIRECTORY); //throws Error

    console.log(`\nSyncing: ${relPath}`);

    //Copy to each target directory
    targetConfigurations.forEach((config) => {
        const destDir = path.resolve(SERVER_ROOT, config.relativePath);
        let destPath = path.join(destDir, relPath);
        destPath = destPath.replace(new RegExp(/\.mts$/), config.fileExtension);

        const updatedContent = updateImportExtensions(raw, config);
        
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, updatedContent, 'utf8');

        console.log(`➔  ${destPath}`);
    });
});
