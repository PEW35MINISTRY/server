import Pool from 'pg-pool';
import * as log from './../log.mjs';
import dotenv from 'dotenv';
import { Exception } from '../../api/api-types.mjs';
dotenv.config(); 

const pool = new Pool({
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    host: process.env.DATABASE_END_POINT,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE_NAME
});


export const query = (query:string, parameters?:any[]):any => new Promise((resolve, reject) => {
    log.db("Executing Query: ", query, parameters);

    pool.query(query, parameters || [], (error, result) => {
        if (error) reject(error);
        else if (!result) reject('No Query Results');
        else resolve (result.rows[0]);
});})
.then((res) => res)
.catch(error => {
    log.db('ERROR :: Database Query Failed:', query, parameters, error);   
    return error;
});

export const queryAll = (query:string, parameters?:any[]):any => new Promise((resolve, reject) => {
    log.db("Executing Query All", query, parameters);

    pool.query(query, parameters || [], (error, result) => {
   if (error) reject(error);
   else if (!result) reject('No Query Results');
   else resolve (result.rows);
});})
.then((res) => res || [])
.catch(error => {
    log.db('ERROR :: Database Query ALL Failed:', query, parameters, error);   
    new Exception(502, error);
    return error;
});

export type TestResult = {
    success: boolean,
    result: string,
    error: string,
    query: string,
    parameters: string
}

export const formatTestResult = (success: boolean = false, result: string = 'NONE', error: string = 'NONE', query: string = '', parameters: string = ''):TestResult => ({
    success: success,
    result: result,
    error: error,
    query: query,
    parameters: parameters
});

export const queryTest = (query:string, parameters?:any[]):Promise<TestResult> => new Promise((resolve, reject) => {
    log.db("Executing Test Query: ", query, parameters);
    pool.query(query, parameters || [], (error, result) => {
        if (error) 
            log.db('FAILED :: Database Query Test Failed:', query, parameters, error, result); 
        
        resolve({
            success: !error,
            result: result ? result.toString() : 'NONE',
            error: error ? error.toString() : 'NONE',
            query: query,
            parameters: parameters.toString()
        });
});}).then((res:TestResult) => res);

export default pool;
