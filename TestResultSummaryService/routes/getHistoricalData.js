const { TestResultsDB, ObjectID } = require('../Database');

module.exports = async (req, res) => {
    const { platform, benchmark, testOrBaseline, variant } = req.query;
    const db = new TestResultsDB();

    const datas = [];

        let benchmarkQuery;
        // Return all entries that match the current benchmark and platform

            benchmarkQuery = {
                $and: [
                    { buildName: { $regex: platform } },
                    { sdkResource: testOrBaseline },
                    {
                        aggregateInfo: {
                            $elemMatch: {
                                benchmarkName: benchmark,
                                benchmarkVariant: variant,
                            },
                        },
                    },
                ],
            };
            const result = await db.getData(benchmarkQuery).toArray()

    datas.push(result);
    res.send(datas);
};