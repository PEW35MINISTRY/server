// import express, { Application , Request, Response} from 'express';


// module.exports = function(app){

//     app.get('/route/', function(request: Request, response: Response){
//         response.status(200).send("This is routes URL")
//     });

// }

import fs from 'fs';

export default function(app){
    console.log('index');
    fs.readdirSync(__dirname).forEach(function(file) {
        console.log(file);
        if (file == "index.mts") return;
        var name = file.substr(0, file.indexOf('.'));
        const s = './' + name;
        // @ts-ignore
        import mm from s;
        mm(app);
        // const module = import('./' + name)(app);
    });
}

