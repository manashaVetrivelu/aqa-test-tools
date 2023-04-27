const BenchmarkMetric = require('./BenchmarkMetric');

class Utils {
    static getBenchmarkParserKey(testName) {
        for (let key of Object.keys(BenchmarkMetric)) {
            if (testName.includes(key)) {
                return key;
            }
        }
        return null;
    }

    static parseOutput(benchmarkParserkey, testOutput) {
        let isValid = true;
        let curTestData = {};
        let curBenchVariant = null;
        let curMetric = null;
        let curRegexResult = null;
        let curRegexResultInner = null;
        let curMetricValues = null;
        let curRegex = null;
        let currentTestOutput = null;

        if (
            !BenchmarkMetric[benchmarkParserkey] ||
            !BenchmarkMetric[benchmarkParserkey]['metrics'] ||
            Object.keys(BenchmarkMetric[benchmarkParserkey]['metrics'])
                .length === 0
        ) {
            isValid = false;
        }

        if (isValid) {
            curBenchVariant = BenchmarkMetric[benchmarkParserkey];

            // if outerRegex is undefined, all runs should be measured. Parse metrics in every run
            // if outerRegex is defined, any runs before outerRegex will be ignored. Parse metrics in warm runs only
            if (curBenchVariant.outerRegex !== undefined) {
                if (
                    (curRegexResult =
                        curBenchVariant.outerRegex.exec(testOutput)) !== null
                ) {
                    // index 0 contains entire text (curItr.value)
                    // index 1 contains text after the outerRegex
                    testOutput = curRegexResult[1];
                }
            }
            if (curBenchVariant.innerRegex !== undefined){
                if (
                    (curRegexResult =
                        curBenchVariant.innerRegex[Symbol.split](testOutput)) !== null
                ) {
                    // index 0 contains the text before the innerRegex
                    testOutput = curRegexResult[0];
                }
            }

            // Parse metric values
            curTestData['metrics'] = [];
            let curMetricList = Object.keys(curBenchVariant['metrics']);
            for (let i = 0; i < curMetricList.length; i++) {
                currentTestOutput = testOutput;
                curMetric = curMetricList[i];
                //seeing if the innerRegex is present inside the metric
                if (curBenchVariant['metrics'][curMetric]['innerRegex'] !== undefined){
                    if (
                        (curRegexResultInner =
                            curBenchVariant['metrics'][curMetric]['innerRegex'][Symbol.split](currentTestOutput)) !== null
                    ) {
                        // index 0 contains the text before the innerRegex
                        currentTestOutput = curRegexResultInner[0];
                    }
                }
                if (curBenchVariant['metrics'][curMetric]['outerRegex'] !== undefined){
                    if (
                        (curRegexResultInner =
                            curBenchVariant['metrics'][curMetric]['outerRegex'].exec(currentTestOutput)) !== null
                    ) {
                        // index 1 contains the text after outerRegex
                        currentTestOutput = curRegexResultInner[1];
                    }
                }
                curRegex = curBenchVariant['metrics'][curMetric]['regex'];
                /*	Parse all values for single metric from result to an array
                 *  e.g
                 *  Liberty Startup =>
                 *  curRegexResult = ['startup time in ms 32',32,'startup time in ms 41',41, x 6]
                 *  Liberty Throughput =>
                 *  curRegexResult = ['<metric type="throughput">32<\/data>',32]
                 */
                curRegexResult = currentTestOutput.split(curRegex);
                //collect only the capture groups from the regex array
                curRegexResult = curRegexResult.filter(
                    (value, index) => index % 2 === 1
                );
                curMetricValues = curRegexResult.map(parseFloat);
                /* Metrics such as JITCPU total in LibertyThroughput and geomean_GCA in CryptoBB,
                 * require aggregate function to be applied.
                 * e.g JIT CPU total values are collected as [ 0,0,300,200,20 ] but we display 520 as the JITCPU total
                 */
                if (
                    typeof curBenchVariant['metrics'][curMetric]['funcName'] !=
                        'undefined' &&
                    curMetricValues.length != 0
                ) {
                    curMetricValues = [
                        curBenchVariant['metrics'][curMetric]['funcName'](
                            curMetricValues
                        ),
                    ];
                }
                curTestData['metrics'].push({
                    name: curMetric,
                    value: curMetricValues,
                });
            }
        } else {
            return null;
        }
        return curTestData;
    }

    static perfBuildResult(tests) {
        let buildResult;
        if (tests.map((x) => x.testResult).indexOf('PASSED') > -1) {
            if (tests.map((x) => x.testResult).indexOf('FAILED') > -1) {
                buildResult = 'UNSTABLE';
            } else {
                buildResult = 'SUCCESS';
            }
        } else {
            buildResult = 'FAILURE';
        }
        return buildResult;
    }

    static getInfoFromBuildName(buildName) {
        const regex =
            /^Test_openjdk(\w+)_(\w+)_(\w+).(.+?)_(.+?_.+?(_xl)?)(_.+)?$/i;
        const tokens = buildName.match(regex);
        if (Array.isArray(tokens) && tokens.length > 5) {
            const [_, jdkVersion, jdkImpl, level, group, platform] = tokens;
            return { jdkVersion, jdkImpl, level, group, platform };
        }
        return null;
    }
}
module.exports = Utils;
