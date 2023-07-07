import React, { Component } from 'react';
import Chart from "react-apexcharts";
import { Route } from 'react-router';
import { Link } from 'react-router-dom';
import { QuestionCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Tooltip, Collapse, Checkbox, TreeSelect } from 'antd';
import ReactTable from 'react-table';
import './Graph.css';
import 'react-table/react-table.css';
import PropTypes from 'prop-types';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import { getParams } from '../utils/query';
import 'react-day-picker/lib/style.css';
import { getInfoFromBuildName, fetchData } from '../utils/Utils';


// Overlay for the date picker component
function CustomOverlay({ classNames, selectedDay, children, ...props }) {
  return (
      <div
          className={classNames.overlayWrapper}
          style={{ marginLeft: -100 }}
          {...props}
      >
          <div className={classNames.overlay}>
              <p>
                  {selectedDay
                      ? `Currently Chosen JDK Date: ${selectedDay.toLocaleDateString()}`
                      : 'Choose JDK Date'}
              </p>
              {children}
          </div>
      </div>
  );
}

CustomOverlay.propTypes = {
  classNames: PropTypes.object.isRequired,
  selectedDay: PropTypes.instanceOf(Date),
  children: PropTypes.node.isRequired,
};

export default class Graph extends Component {
    constructor(props) {
        super(props);
        this.handleDayChange = this.handleDayChange.bind(this);
        this.state = {
        
          inputURL: {
            platform: '',
            benchmarkName: '',
          },        
        };
      }

      async componentDidMount() {
        let inputURL = {};
        const urlData = getParams(window.location.search);
        for (let url in urlData) {
            inputURL[url] = urlData[url];
        }
        await this.setState({ inputURL: inputURL });

        await this.initializeJdk();
        await this.getData();

      }

      //the data is fetched from the database
      //this function is only called once at the beginning when the page mounts. 
      async getData()
      {
        //get all the data from the database that matches the platform and benchmark
        let testInfo = await fetchData(`/api/getHistoricalData?platform=${this.state.inputURL.platform}&benchmark=${this.state.inputURL.benchmarkName}&testOrBaseline=nightly&variant=${this.state.inputURL.benchmarkVariant}`);
        let baselineInfo = await fetchData(`/api/getHistoricalData?platform=${this.state.inputURL.platform}&benchmark=${this.state.inputURL.benchmarkName}&testOrBaseline=releases&variant=${this.state.inputURL.benchmarkVariant}`);

        this.setState({ test: testInfo });
        this.setState({ base: baselineInfo });

        await this.displayData(testInfo, baselineInfo, false);
      }
      
      //displays the data that is requested
      async displayData(testInfo, baselineInfo, remove)
      {       
        const index = _.findIndex(testInfo[0][0].aggregateInfo, {
          benchmarkName: this.state.inputURL.benchmarkName, //get the benchmarkname from the state
          benchmarkVariant: this.state.inputURL.benchmarkVariant //benchmark variant from the state
        }); 
        let metric = testInfo[0][0].aggregateInfo[index].metrics.length;
        let allMetricData = [];

              for (let item = 0; item < metric; item++)
              {
                if(!remove) //if triggered to be removed
                {
                  await this.getDataValues(item, testInfo, baselineInfo, index);
                }
                let individual = (<div key={item}>
                                    <Chart options={this.state.options} series={this.state.series} type="line" width={1000} height={350} />
                                  </div>)
                allMetricData.push(individual);
              }  
        
        //this.setState((state) => { graphs: allMetricData });  
        this.setState({ graphs: allMetricData }); 
      }

      //function to post after removal as a backup if the remove boolean doesn't work in displayData
      async displayPostRemoval(amount, series)
      {

        let allMetricData = [];
        for (let item = 0; item < amount; item++)
        {
          let individual = (<div key={item}>
                              <Chart options={this.state.options} series={series} type="line" width={1000} height={350} />
                            </div>)
          allMetricData.push(individual);
        }
        //this.setState({ graphs: allMetricData });
        //this.forceUpdate();

        this.setState({graphs: allMetricData}, function stateUpdateComplete() {
          console.log(this.state.graphs);
      }.bind(this));
      }

      //the data has already been retrieved from the database and stored in the states. 
      async getDataValues(metric, testInfo, baselineInfo, index)
      {
        let data = [];
        let baselineData = [];
        let graphPercentages = [];
        let graphPerc= {};
        let date = [];
        let baseLineDate = [];
        let objects = [];
        let baselineObjects = [];
        let object = {};
        let baselineObject = {};

        let name = testInfo[0][0].aggregateInfo[index].metrics[metric].name;

        //go through every item and only get the buildDate and mean
        for (let item = 0 ; item < testInfo[0].length ; item++)
        {
            let buildDate = this.getBuildDate(testInfo[0][item]);
    
          object = {
            x : buildDate,
            y : testInfo[0][item].aggregateInfo[index].metrics[metric].statValues.mean //only doing the first benchmark and the first metric rn
          };
          objects.push(object);
        }
        //sort the objects according to date
        objects.sort(function(a, b) {
          return parseFloat(a.x) - parseFloat(b.x);
        });

        for (let item = 0 ; item < baselineInfo[0].length ; item++)
        {
            let buildDate = this.getBuildDate(baselineInfo[0][item]);

          baselineObject = {
            x : buildDate,
            y : baselineInfo[0][item].aggregateInfo[index].metrics[metric].statValues.mean //only doing the first benchmark and the first metric rn
          }
          baselineObjects.push(baselineObject);
        }
        //sort the objects according to date
        baselineObjects.sort(function(a, b) {
          return parseFloat(a.x) - parseFloat(b.x);
        });

        let fromDate = this.state.testJdkDate;
        let toDate = this.state.baselineJdkDate;

        let filtered = objects.filter(function(a) {
          return (a.x >= fromDate && a.x <= toDate);
        });

        let filteredBaseline = baselineObjects.filter(function(a) {
          return (a.x >= fromDate && a.x <= toDate);
        });

        //this is the start of the percentages part
        //for now I am going to assume that test/baseline and that they number in test and baseline is the same

        if (filtered.length !== filteredBaseline.length)
        {
          let individual = (<div>
                              <h6> Different amount of Test Runs and Baseline Runs </h6>
                            </div>)

          this.setState({error: individual});
        }
        else{
          let individual = (<div>
            <h6></h6>
          </div>)

          this.setState({error: individual});
        }

        //create graph based on whichever has the least

        //for now, if the number of test and baseline data is different, it'll remove the extra one. 
        if (filtered.length > filteredBaseline.length)
        {
          filtered.pop();
        }
        else if (filtered.length < filteredBaseline.length){
          filteredBaseline.pop();
        }


        for(let item in filtered)
        {

          let percentage = filtered[item].y/filteredBaseline[item].y;
          percentage = percentage *100;
          graphPerc = {
            x : filtered[item].x,
            y : percentage
          }
          graphPercentages.push(graphPerc);
            
        }

        //this is the end of the percentages part



        //i'm using the data to find the lowest and highest value for the graph values
        //date values are being pushed because
        for (let item in filtered)
        {
          data.push(filtered[item].y);
          date.push(filtered[item].x);
        }

        for (let item in filteredBaseline)
        {
          baselineData.push(filteredBaseline[item].y);
          baseLineDate.push(filteredBaseline[item].x);
        }
        let highest = Math.max(...data);
        let lowest = Math.min(...data);

        const highBase = Math.max(...baselineData);
        const lowBase = Math.min(...baselineData);

        if(this.state.graphType == "Percentage")
        {
          //finding the highest and lowest value in the graph percentages. 

          let values = [];
          for (let item in graphPercentages)
          {
            values.push(graphPercentages[item].y);
          }

          let high = Math.max(...values);
          let low  = Math.min(...values);
          highest=high + 5;
          lowest=low - 5;

          this.setState({
            series: [
              {
                name: "Test",
                data: graphPercentages
              },
            ],
          });          
        }
        else{
          this.setState({
            series: [
              {
                name: "Test",
                data: filtered
              },
              {
                name: "Baseline",
                data: filteredBaseline
              }
            ],
          });
          //for graphType Score
          if(this.state.graphType == "Score")
          {
            if (highBase > highest)
            {
              highest = highBase + 50;
            }
            else{
              highest += 50;
            }
            if (lowBase < lowest)
            {
              lowest = lowBase - 50;
            }
            else{
              lowest -= 50;
            }
          }
          else{
            if (highBase > highest)
            {
              highest = highBase + 50;
            }
            else{
              highest += 50;
            }
            lowest = 0;
          }
        }

        //just to check the values
        console.log("Test Data:");
        console.log(filtered);
        console.log("Baseline Data:")
        console.log(filteredBaseline);

        this.setState({
          options: {
            chart: {
              height: 350,
              type: 'line',
              events: {
                markerClick: (event, chartContext, { seriesIndex, dataPointIndex, config}) => {
                  console.log(dataPointIndex);
                  

                  var x;
                  if (confirm("Remove?") == true) {
                      x = "You pressed OK!";
                      filtered.splice(dataPointIndex, 1);
                      filteredBaseline.splice(dataPointIndex,1);
                      this.setState({
                        series: [
                          {
                            name: "Test",
                            data: filtered
                          },
                          {
                            name: "Baseline",
                            data: filteredBaseline
                          }
                        ],
                      }, async function(){
                        console.log("Has been removed");
                        console.log(filtered);
                        let amount = this.state.graphs.length;
                        console.log(this.state.series);
                        //await this.displayData(testInfo,baselineInfo, true);
                        await this.displayPostRemoval(amount, this.state.series);
                        
                      });


                  } else {
                      x = "You pressed Cancel!";
                  }
                  console.log(x); 
                }
              },
              dropShadow: {
                enabled: true,
                color: '#000',
                top: 18,
                left: 7,
                blur: 10,
                opacity: 0.2
              },
              toolbar: {
                show: false
              }
            },
            colors: ['#77B6EA', '#545454'],
            dataLabels: {
              enabled: false,
            },
            title: {
              text: name,
              align: 'left'
            },
            grid: {
              borderColor: '#e7e7e7',
              row: {
                colors: ['#f3f3f3', 'transparent'], // takes an array which will be repeated on columns
                opacity: 0.5
              },
            },
            markers: {
              size: 1
            },
            xaxis: {
              type: 'category',
              title: {
                text: 'Date'
              }
            },
            yaxis: {
              title: {
                text: this.state.graphType,
              },
              min: lowest,
              max: highest
            },
            legend: {
              position: 'top',
              horizontalAlign: 'right',
              floating: true,
              offsetY: -25,
              offsetX: -10
            }
          },
        });
      }

      async handleSubmit()
      {
        //await this.displayData();
        await this.displayData(this.state.test, this.state.base, false);
      }

      handleRemove()
      {
        console.log("hello");
      }

          // Set default values for choosing the JDK including date, version, type and sdk resource if URL has missing information
      async initializeJdk() {
        const date = new Date().getDate().toString();
        const month = (new Date().getMonth() + 1).toString(); //Current Month
        const year = new Date().getFullYear().toString(); //Current Year
        // Assumption: JDK date is in the format of YYYYMMDD in database, example: 20190814
        const jdkDate =
            year +
            (month.length < 2 ? '0' + month : month) +
            (date.length < 2 ? '0' + date : date);

        /*
        Each database entry should contain a pipeline name (buildName) which contains the JDK Version and JVM Type.
        sdkResource in the form of null, releases, nightly, customized or upstream
        date is in the jdkDate field and in the form of YYYYMMDD
        Default values are defined in TabularViewConfig.json. Add the optional Jenkins server otherwise will default to first option
        */

        !('testJdkDate' in this.state) &&
            this.setState({ testJdkDate: jdkDate });
        !('baselineJdkDate' in this.state) &&
            this.setState({ baselineJdkDate: jdkDate });
      }

      async handleChange(event) {

        this.setState(
          { 
            [event.target.name]: event.target.value,
          }, 
          async function () {
            await this.displayData(this.state.test, this.state.base, false);
        });

      }

      handleDayChange(selectedDay, modifiers, dayPickerInput) {
        const input = dayPickerInput.getInput();
        this.setState(
            {
                selectedDay,
                isEmpty: !input.value.trim(),
                isDisabled: modifiers.disabled === true,
            },
            function () {
                if (this.state.selectedDay !== undefined) {
                    // Transform date to correct format
                    this.dateTransform(
                        this.state.selectedDay.toLocaleDateString(),
                        dayPickerInput.props.dayPickerProps.type
                    );
                }
            }
        );
      }

      dateTransform(date, type) {
        const dateSplit = date.split('-');
        // Database date format: YYYYMMDD
        const jdkDate =
            (dateSplit[0]) +
            (dateSplit[1].length < 2 ? '0' + dateSplit[1] : dateSplit[1]) +
            (dateSplit[2].length < 2 ? '0' + dateSplit[2] : dateSplit[2]);

        if (type === 'test') {
            this.setState({ testJdkDate: jdkDate });
        } else {
            this.setState({ baselineJdkDate: jdkDate });
        }
    }

    getBuildDate(element) {
            if (element.sdkResource == "releases") {
                return this.parseTimestamp(element.timestamp);
            } else {
                let re = /(Compressed References)\s(\d{8})/;
                let javaVersion = element.javaVersion.match(re);
    
                if (javaVersion) {
                    let correctDate = javaVersion[2];
                    return correctDate;
                } else {
                    return element.jdkDate;
                }
    
            }
        
    }
    
    parseTimestamp(timestamp) {
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

    render() {
        return (
          <div>
           <h3>Benchmark: {this.state.inputURL.benchmarkName}</h3>
           <h3>Platform: {this.state.inputURL.platform}</h3>
           <div className="row">
                    <div className="columnGraph" id="header">
                        {' '}
                        Date Range <br />{' '}
                    </div>
                    <div className="columnGraph">
                        <DayPickerInput
                            onDayChange={this.handleDayChange}
                            value={this.state.testJdkDate}
                            overlayComponent={CustomOverlay}
                            dayPickerProps={{
                                todayButton: 'Today',
                                type: 'test',
                            }}
                            keepFocus={false}
                        />
                    </div>
                    <div className="columnGraph">
                        <DayPickerInput
                            onDayChange={this.handleDayChange}
                            value={this.state.baselineJdkDate}
                            overlayComponent={CustomOverlay}
                            dayPickerProps={{
                                todayButton: 'Today',
                                type: 'baseline',
                            }}
                            keepFocus={false}
                        />
                    </div>
                    <div className="columnGraph">
                      <Button type="primary" onClick={this.handleSubmit.bind(this)}>
                        Submit
                      </Button>
                    </div>
            </div>
            <div className="row">
                    <div className="columnGraph" id="header">
                        {' '}
                        Choose Graph Type <br />{' '}
                    </div>
                    <div className="columnGraph">
                      <input type="radio" name="graphType" value="Default" onChange={this.handleChange.bind(this)}/> Default
                    </div>
                    <div className="columnGraph">
                      <input type="radio" name="graphType" value="Score" onChange={this.handleChange.bind(this)}/> Score
                    </div>
                    <div className="columnGraph">
                      <input type="radio" name="graphType" value="Percentage" onChange={this.handleChange.bind(this)}/> Percentage
                    </div>
              </div>
            {this.state.graphs}
          </div>
        )
      }
}


