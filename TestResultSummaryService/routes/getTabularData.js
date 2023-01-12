const { TestResultsDB, ObjectID } = require('../Database');

function exceedDate(jdkDate) {
    return function (element) {
        if (element.sdkResource == "releases") {
            return parseInt(parseTimestamp(element.timestamp)) <= parseInt(jdkDate);
        } else {
            let re = /(Temurin)-([^-]+)-(\d{8})/;
            let javaVersion = element.javaVersion.match(re);

            if (javaVersion) {
                correctDate = javaVersion[3];
                return parseInt(correctDate) <= parseInt(jdkDate);
            } else {
                return parseInt(element.jdkDate) <= parseInt(jdkDate);
            }

        }
    }
}

function parseTimestamp(timestamp) {
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    let dateString = "";

    if (day.toString().length == 1) {
        dateString = year.toString() + months[month] + '0' + day.toString();
    } else {
        dateString = year.toString() + months[month] + day.toString();
    };
    return dateString;
}

module.exports = async (req, res) => {
    const data = [];
    const db = new TestResultsDB();

    const datas = [];
    // TODO: Use available api to get build directly
    const query = {
        buildName: {
            $regex:
                '.*_' +
                req.query.jdkVersion +
                '_' +
                req.query.jvmType +
                '.*perf_.*',
        },
        url: req.query.buildServer,
    };

    // Get list of distinct platforms and benchmarks that match the JDK pipeline
    const platBenchList = await db.aggregate([
        {
            $match: query,
        },
        // Needed to access values inside array
        { $unwind: '$aggregateInfo' },
        {
            $group: {
                _id: 0,
                buildNames: { $addToSet: '$buildName' },
                benchmarks: { $addToSet: '$aggregateInfo.benchmarkName' },
            },
        },
    ]);

    let { platforms, benchmarks } = [];
    // Error handling in case no builds are found
    if (platBenchList[0]) {
        platforms = platBenchList[0].buildNames;
        benchmarks = platBenchList[0].benchmarks;
    }
    // Extra check to return builds whose sdkResource field does not exist or is null.
    let sdkResourceQuery;
    if (req.query.sdkResource === 'null') {
        sdkResourceQuery = null;
    } else {
        sdkResourceQuery = req.query.sdkResource;
    }

    for (benchmarkIndex in benchmarks) {
        let benchmarkQuery;
        // Return all entries that match the current benchmark and platform
        for (item in platforms) {
            benchmarkQuery = {
                $and: [
                    { buildName: { $regex: platforms[item] } },
                    { sdkResource: sdkResourceQuery },
                    {
                        aggregateInfo: {
                            $elemMatch: {
                                benchmarkName: benchmarks[benchmarkIndex],
                            },
                        },
                    },
                ],
            };
            const result = await db.getData(benchmarkQuery).toArray();

            // Remove all entries whose build date exceeds the chosen date
            const exceedFilter = result.filter(exceedDate(req.query.jdkDate));
            // Grab date from jdk version
            exceedFilter.forEach(function(element, index, theArray) {
                if (exceedFilter[index].sdkResource == "releases") {
                }
                else {
                    let re = /(Temurin)-([^-]+)-(\d{8})/;
                    let javaVersion = element.javaVersion.match(re);
                    console.log( `Show me: ${exceedFilter[index].sdkResource}, ${javaVersion}, ` );
                    if (javaVersion) {
                        correctDate = javaVersion[3];
                        exceedFilter[index].jdkDate = correctDate;
                    }
                }
              });
            // Setting the latest build date from the available dates
            const latestDate = Math.max.apply(
                Math,
                exceedFilter.map(function (o) {
                    return parseInt(o.jdkDate.replace(/[\s()-]+/gi, ''));
                })
            );
            // Remove all runs that are not the latest
            const dateFilter = exceedFilter.filter(
                (entry) => parseInt(entry.jdkDate.replace(/[\s()-]+/gi, '')) === latestDate
            );
            const latest = Math.max.apply(
                Math,
                dateFilter.map(function (o) {
                    return o.timestamp;
                })
            );
            // Keep the latest build with the latest timestamp
            const latestRun = dateFilter.find(function (o) {
                return o.timestamp == latest;
            });

            if ((latestRun !== undefined)) {
                let exists = false;
                for (build in datas) {
                    if ((datas[build].buildNum == latestRun.buildNum) && (datas[build].buildName == latestRun.buildName)) {
                        exists = true;
                    }
                }
                if (!exists) {
                    datas.push( latestRun );
                }
            }

        }
    }
    // Return the list of unique pipeline names for column generation
    const buildNames = [...new Set(datas.map((item) => item.buildName))];
    datas.push(buildNames);
    res.send(datas);
};
