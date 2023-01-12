const got = require('got');
const fetch  = require('node-fetch');
const url = require('url');
const { logger, addCredential } = require('./Utils');
const ArgParser = require('./ArgParser');
const { Build } = require('./parsers');
const e = require('express');



class BuildOutputStream {
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
    async getOutputText() 
    {
        const response = await fetch(this.url);
        if(response.ok)
        {
            const data = await response.text();
            return data
        }
        else
        {
            logger.warn(
                `BuildOutputStream: getOutputText(): Exception: ${response.status}`
            );
            return response.status; //have it just return the error status 
        }
    }

    // check the response size using http head request
    //dont ever use it though
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

module.exports = BuildOutputStream;
