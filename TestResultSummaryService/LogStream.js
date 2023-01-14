const got = require('got');
const fetch  = require('node-fetch');
const url = require('url');
const { logger, addCredential } = require('./Utils');
const ArgParser = require('./ArgParser');
const { Build } = require('./parsers'); //not sure if these are actually needed 
const e = require('express');

class LogStream {
    constructor(options) {
        this.credentails = ArgParser.getConfig();
        const build = options.build || 'lastBuild';
        this.url =
            addCredential(this.credentails, options.baseUrl) +
            '/job/' +
            options.job +
            '/' +
            build +
            '/logText/progressiveText';
    }

    //this function gets the output given for that build
    //it also makes sure that the output size is not too large as the output is sometimes huge when the build fails
    async getOutputText() 
    {
        const response = await fetch(this.url);
        if(response.ok)
        {
            const data = await response.text();

            // Due to 1G string limit and possible OOM in CI server and/or TRSS, only query the output < 50M
            // Regular output should be 2~3M. In rare cases, we get very large output
            // ToDo: we need to update parser to handle segmented output
            const size = Buffer.byteLength(data, 'utf8');

            if (size > -1) {
                const limit = Math.floor(50 * 1024 * 1024);
                if (size < limit) {
                    return data;               
                } 
                else {
                    logger.debug(
                        `BuildOutputStream: getOutputText(): Output size ${size} > size limit ${limit}`
                    );
                    throw `Output size ${size} > size limit ${limit}`;
                }
            } 
            else {
                throw `Cannot get build output size: ${size}`;
            }            
        }
        else{
            logger.warn(
                `BuildOutputStream: getOutputText(): Exception: ${response.status}`
            );
            return response.status; //have it just return the error status 
        }
    }

    //the following 2 functions were used before but are no longer being used since the 'got' dependency no longer works
    async next(startPtr) {
        logger.debug(
            `LogStream: next(): [CIServerRequest] url: ${this.url} startPtr: ${startPtr}`
        );
        const response = await got.get(this.url, {
            followRedirect: true,
            query: { start: startPtr },
            timeout: 4 * 60 * 1000,
        });
        if (response.body.length === 0) {
            return '';
        } else {
            return response.body;
        }
    }

    // check the response size using http head request
    async getSize() {
        logger.debug(
            `LogStream: getSize(): [CIServerRequest] url: ${this.url}`
        );
        // set timeout to 4 mins
        const timeout = 4 * 60 * 1000;
        const { headers } = await got.head(this.url, { timeout });
        if (headers && headers['x-text-size']) {
            logger.debug(
                `LogStream: getSize(): size: ${headers['x-text-size']}`
            );
            return headers['x-text-size'];
        } else {
            return -1;
        }
    }
}

module.exports = LogStream;
