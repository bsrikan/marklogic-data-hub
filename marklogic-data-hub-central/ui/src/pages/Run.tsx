import React, { useState, useEffect, useContext } from 'react';
import styles from './Run.module.scss';
import Flows from '../components/flows/flows';
import { Modal, Collapse, Icon } from 'antd';
import axios from 'axios'
import { AuthoritiesContext } from "../util/authorities";
import { UserContext } from '../util/user-context';
import { useHistory } from 'react-router-dom';


const { Panel } = Collapse;

interface PollConfig {
    interval: number;
    retryLimit: number;
}

const Statuses = {
    'FINISHED': 'finished',
    'CANCELED': 'canceled',
    'FAILED': 'failed',
    'FINISHED_WITH_ERRORS': 'finished_with_errors'
}

const Run = (props) => {
   const { handleError, resetSessionTime } = useContext(UserContext);

    const history: any = useHistory();

    const [isLoading, setIsLoading] = useState(false);
    const [flows, setFlows] = useState<any[]>([]);
    const [steps, setSteps] = useState<any>({});
    const [runStarted, setRunStarted] = useState<any>({});
    const [runEnded, setRunEnded] = useState<any>({});
    const [running, setRunning] = useState<any[]>([]);
    const [uploadError, setUploadError] = useState('');

    // For role-based privileges
    const authorityService = useContext(AuthoritiesContext);
    const canReadFlow = authorityService.canReadFlow();
    const canWriteFlow = authorityService.canWriteFlow();
    const hasOperatorRole = authorityService.canRunStep();

    //For handling flows expand and collapse within Run tile
    const [newFlowName, setNewFlowName] = useState('');
    const { success, error } = Modal;
    const [flowsDefaultActiveKey, setFlowsDefaultActiveKey] = useState<any []>([]);

    const pollConfig: PollConfig = {
        interval: 1000, // In millseconds
        retryLimit: 10  // Timeout after retries
    }

    useEffect(() => {
        return () =>  Modal.destroyAll()
    }, []);

    useEffect(() => {
        getFlows();
        getSteps();
        return (() => {
            setFlows([]);
            setSteps([]);
        })
    }, [isLoading]);

    useEffect(() => {
        setRunning([...running, runStarted]);
    }, [runStarted]);

    useEffect(() => {
        setRunning([...running].filter(
            r => (r.flowId !== runEnded.flowId || r.stepId !== runEnded.stepId)
        ));
    }, [runEnded]);

    const getFlows = async () => {
        try {
            let response = await axios.get('/api/flows');
            if (response.status === 200) {
                if(newFlowName){
                    let key = [response.data.findIndex(el => el.name === newFlowName)]
                    setFlowsDefaultActiveKey(key);
                }
                setFlows(response.data);
            }
        } catch (error) {
            console.error('Error getting flows', error);
            handleError(error)
        }
    }

    const getSteps = async () => {
        try {
            let response = await axios.get('/api/steps');
            if (response.status === 200) {
                setSteps(response.data);
            }
        } catch (error) {
            console.error('********* ERROR', error);
            let message = error.response.data.message;
            console.error('Error getting steps', message);
        } finally {
          resetSessionTime();
        }
    }

    const createFlow = async (payload) => {
        let newFlow;
        try {
            setIsLoading(true);
            newFlow = {
                name: payload.name,
                description: payload.description
            }
            let response = await axios.post(`/api/flows`, newFlow);
            if (response.status === 201) {
                setIsLoading(false);
                setNewFlowName(payload.name);
            }
        }
        catch (error) {
            console.error('Error posting flow', error);
            setIsLoading(false);
            let message = error.response.data.message;
            message.indexOf(newFlow.name) > -1 ? Modal.error({
                content: <p>Unable to create a flow. Flow with the name <b>{newFlow.name}</b> already exists.</p>
            }) : Modal.error({
                content: message
            })
        }
    }

    const updateFlow = async (payload, flowId) => {
        try {
            setIsLoading(true);
            let updatedFlow = {
                name: payload.name,
                description: payload.description,
            }
            let response = await axios.put(`/api/flows/` + flowId, updatedFlow);
            if (response.status === 200) {
                setIsLoading(false);
            }
        }
        catch (error) {
            console.error('Error updating flow', error)
            setIsLoading(false);
        }
    }

    // POST a step to existing flow
    const addStepToFlow = async (artifactName, flowName, stepDefinitionType) => {
        let step = {
            "stepName": artifactName,
            "stepDefinitionType": stepDefinitionType
        };
        try {
            setIsLoading(true);
            let url = '/api/flows/' + flowName + '/steps';
            let body = step;
            let response = await axios.post(url, body);
            if (response.status === 200) {
                setIsLoading(false);
                return 1;
            }
        } catch (error) {
            let message = error.response.data.message;
            console.error('Error while adding load data step to flow.', message);
            setIsLoading(false);
            Modal.error({
                content: 'Error adding step "' + artifactName + '" to flow "' + flowName + '."',
            });
            handleError(error);
        }
    }

    const deleteFlow = async (name) => {
        try {
            setIsLoading(true);
            let response = await axios.delete(`/api/flows/${name}`);
            if (response.status === 200) {
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error deleting flow', error);
            setIsLoading(false);
        }
    }

    // function formatStepType(stepType){
    //     stepType = stepType.toLowerCase();
    //     return stepType[0].toUpperCase() + stepType.substr(1);
    // }

    const goToExplorer = (entityName, jobId) => {
        history.push({pathname: "/tiles/explore",
            state: { entityName: entityName, jobId: jobId }})
        Modal.destroyAll();
    }

    function showStepRunResponse(stepName, stepType, entityName, jobId, response){
        if (response['jobStatus'] === Statuses.FINISHED) {
            showSuccess(stepName, stepType, entityName, jobId);
        } else if (response['jobStatus'] === Statuses.FINISHED_WITH_ERRORS) {
            let errors = getErrors(response);
            showErrors(stepName, stepType, errors, response, entityName, jobId);
        } else if (response['jobStatus'] === Statuses.FAILED) {
            let errors = getErrors(response);
            showFailed(stepName, stepType, errors.slice(0,1));
        }
    }

    function showSuccess(stepName, stepType, entityName, jobId) {
         Modal.success({
              title:<div><p style={{fontWeight: 400}}>The {stepType.toLowerCase()} step <strong>{stepName}</strong> completed successfully</p></div>,
               icon: <Icon type="check-circle" theme="filled"/>, 
               okText: 'Close',
               mask: false,
               width:650,
               content: stepType.toLowerCase() === 'mapping' && entityName ?
                   <div data-testId='explorer-link' onClick={()=> goToExplorer(entityName, jobId)} className={styles.exploreCuratedData}>
                   <span className={styles.exploreIcon}></span>
                   <span className={styles.exploreText}>Explore Curated Data</span>
               </div> : ''
           });
    }

    function getErrors(response) {
        let errors = [];
        if (response['stepResponses']) {
            let stepProp = Object.keys(response['stepResponses'])[0];
            errors = response['stepResponses'][stepProp]['stepOutput'];
        }
        return errors;
    }

    function getErrorsSummary(response) {
        let maxErrors = 10; // Returned from backend
        let stepProp = Object.keys(response['stepResponses'])[0];
        let jobResp = response['stepResponses'][stepProp];
        return (<span>Out of {jobResp['successfulBatches']+jobResp['failedBatches']} batches,
            <span className={styles.errorVal}> {jobResp['successfulBatches']}</span> succeeded and
            <span className={styles.errorVal}> {jobResp['failedBatches']}</span> failed.
            {(jobResp['failedBatches'] > maxErrors) ?
                <span> The first {maxErrors} error messages are listed below.</span> :
                <span> The error messages are listed below.</span>}
            </span>);
    }

    const getErrorsHeader = (index) => (
        <span className={styles.errorHeader}>
            Error {index+1}
        </span>
    );

    function showErrors(stepName, stepType, errors, response, entityName, jobId) {
         Modal.error({
            title: <p style={{fontWeight: 400}}>The {stepType.toLowerCase()} step <strong>{stepName}</strong> completed with errors</p>,
            icon: <Icon type="exclamation-circle" theme="filled"/>, 
            content: (
                <div id="error-list">
                    {stepType.toLowerCase() === 'mapping' && entityName ?
                        <div onClick={() => goToExplorer(entityName, jobId)} className={styles.exploreCuratedData}>
                        <span className={styles.exploreIcon}></span>
                        <span className={styles.exploreText}>Explore Curated Data</span>
                    </div> : ''}
                    <p className={styles.errorSummary}>{getErrorsSummary(response)}</p>
                    <Collapse defaultActiveKey={['0']} bordered={false}>
                        {errors.map((e, i) => {
                            return <Panel header={getErrorsHeader(i)} key={i}>
                                 {getErrorDetails(e)}
                            </Panel>
                        })}
                    </Collapse>
                </div>
            ),
            okText: 'Close',
            mask: false,
            width: 800
        });
    }

    function showFailed(stepName, stepType, errors) {
        Modal.error({
            title: <div id="error-title"><p style={{fontWeight: 400}}>The {stepType.toLowerCase()} step <strong>{stepName}</strong> failed</p></div>,
            icon: <Icon type="exclamation-circle" theme="filled"/>, 
            content: (
                <div id="error-list">
                    {errors.map((e, i) => {
                        return getErrorDetails(e)
                    })}
                </div>
            ),
            okText: 'Close',
            mask: false,
            width: 800
        });
    }

    function getErrorDetails(e) {

        try {
            let errorObject = JSON.parse(e);
           return <div>
               <span className={styles.errorLabel}>Message:</span> <span> {errorObject.message}</span><br/><br/>
               <span className={styles.errorLabel}>URI:</span> <span>  {errorObject.uri} </span><br/><br/>
               <span className={styles.errorLabel}>Details:</span>  <span style={{whiteSpace:'pre-line'}}> {errorObject.stack}</span>
            </div>;
        }
        catch(ex) {
            return  <div><span className={styles.errorLabel}>Message:</span>  <span style={{whiteSpace:'pre-line'}}> {e}</span> </div>;
        }
    }


    // Poll status for running flow
    function poll(fn, interval) {
        let tries = 0;
        let checkStatus = (resolve, reject) => {
            let promise = fn();
            promise.then(function(response){
                let status = response.data.jobStatus;
                if (status === Statuses.FINISHED || status === Statuses.CANCELED ||
                    status === Statuses.FAILED || status === Statuses.FINISHED_WITH_ERRORS) {
                    // Non-running status, resolve promise
                    resolve(response.data);
                } else {
                    // Still running, poll again
                    setTimeout(checkStatus, interval, resolve, reject);
                }
            }).catch(function(error) {
                if (tries++ > pollConfig.retryLimit) {
                    // Retry limit reached, reject promise
                    reject(new Error('Over limit, error for ' + fn + ': ' + arguments));
                } else {
                    // Poll again
                    setTimeout(checkStatus, interval, resolve, reject);
                }
            });
        };
        return new Promise(checkStatus);
    }

    // POST /flows​/{flowId}​/steps​/{stepId}
    const runStep = async (flowId, stepDetails, formData) => {
        const stepNumber = stepDetails.stepNumber;
        const stepName = stepDetails.stepName;
        const stepType = stepDetails.stepDefinitionType;
        setRunStarted({flowId: flowId, stepId: stepNumber});
        let response;
        try {
            setUploadError('');
            setIsLoading(true);
            if (formData){
                response = await axios.post('/api/flows/' + flowId + '/steps/' + stepNumber, formData, {headers: {
                    'Content-Type': 'multipart/form-data; boundary=${formData._boundary}', crossorigin: true
                }} )
            }
            else {
                response = await axios.post('/api/flows/' + flowId + '/steps/' + stepNumber);
            }
            if (response.status === 200) {
                let jobId = response.data.jobId;
                await setTimeout( function(){
                    poll(function() {
                        return axios.get('/api/jobs/' + jobId);
                    }, pollConfig.interval)
                    .then(function(response: any) {
                        let entityName;
                        if(response.hasOwnProperty("stepResponses")
                          && response.stepResponses.hasOwnProperty(`${stepNumber}`)
                          && response.stepResponses[`${stepNumber}`].hasOwnProperty('targetEntityType') &&
                            (response.stepResponses[`${stepNumber}`].targetEntityType !== null || undefined))
                        {
                          let splitTargetEntity = response.stepResponses[`${stepNumber}`].targetEntityType.split("/");
                          entityName = splitTargetEntity[splitTargetEntity.length-1];
                        }
                        setRunEnded({flowId: flowId, stepId: stepNumber});
                        showStepRunResponse(stepName, stepType, entityName, jobId, response);
                        setIsLoading(false);
                    }).catch(function(error) {
                        console.error('Flow timeout', error);
                        setRunEnded({flowId: flowId, stepId: stepNumber});
                        setIsLoading(false);
                    });
                }, pollConfig.interval);
            }
        } catch (error) {
            console.error('Error running step', error);
            setRunEnded({flowId: flowId, stepId: stepNumber});
            setIsLoading(false);
            if (error.response && error.response.data && ( error.response.data.message.includes('The total size of all files in a single upload must be 100MB or less.') ||  error.response.data.message.includes('Uploading files to server failed') )) {
                setUploadError(error.response.data.message)
            }
        }
    }

    // DELETE /flows​/{flowId}​/steps​/{stepId}
    const deleteStep = async (flowId, stepNumber) => {
        let url = '/api/flows/' + flowId + '/steps/' + stepNumber;
        try {
            setIsLoading(true);
            let response = await axios.delete(url);
            if (response.status === 200) {
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error deleting step', error);
            setIsLoading(false);
        }
    }

  return (
    <div>
        <div className={styles.runContainer}>
            <Flows
                flows={flows}
                steps={steps}
                deleteFlow={deleteFlow}
                createFlow={createFlow}
                updateFlow={updateFlow}
                runStep={runStep}
                deleteStep={deleteStep}
                canReadFlow={canReadFlow}
                canWriteFlow={canWriteFlow}
                hasOperatorRole={hasOperatorRole}
                running={running}
                uploadError={uploadError}
                newStepToFlowOptions={props.newStepToFlowOptions}
                addStepToFlow={addStepToFlow}
                flowsDefaultActiveKey={flowsDefaultActiveKey}
                showStepRunResponse={showStepRunResponse}
                runEnded={runEnded}
            />
        </div>
    </div>
  );
}

export default Run;
