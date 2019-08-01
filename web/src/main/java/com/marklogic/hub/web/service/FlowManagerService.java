/*
 * Copyright 2012-2019 MarkLogic Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.marklogic.hub.web.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.marklogic.hub.DatabaseKind;
import com.marklogic.hub.FlowManager;
import com.marklogic.hub.error.DataHubProjectException;
import com.marklogic.hub.flow.Flow;
import com.marklogic.hub.flow.RunFlowResponse;
import com.marklogic.hub.flow.impl.FlowImpl;
import com.marklogic.hub.flow.impl.FlowRunnerImpl;
import com.marklogic.hub.impl.HubConfigImpl;
import com.marklogic.hub.scaffold.Scaffolding;
import com.marklogic.hub.step.StepDefinition;
import com.marklogic.hub.step.impl.Step;
import com.marklogic.hub.util.json.JSONObject;
import com.marklogic.hub.util.json.JSONUtils;
import com.marklogic.hub.web.exception.BadRequestException;
import com.marklogic.hub.web.exception.DataHubException;
import com.marklogic.hub.web.exception.NotFoundException;
import com.marklogic.hub.web.model.FlowStepModel;
import com.marklogic.hub.web.model.StepModel;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.*;

@Service
public class FlowManagerService {
    protected final Logger logger = LoggerFactory.getLogger(this.getClass());

    public static final String FLOW_FILE_EXTENSION = ".flow.json";

    @Autowired
    private FlowManager flowManager;

    @Autowired
    private FlowRunnerImpl flowRunner;

    @Autowired
    private StepDefinitionManagerService stepDefinitionManagerService;

    @Autowired
    HubConfigImpl hubConfig;

    @Autowired
    private FileSystemWatcherService watcherService;

    @Autowired
    private DataHubService dataHubService;

    @Autowired
    private Scaffolding scaffolding;

    @Autowired
    private AsyncFlowService asyncFlowService;

    public List<FlowStepModel> getFlows() {
        return asyncFlowService.getFlows(true);
    }

    public FlowStepModel createFlow(String flowJson, boolean checkExists) throws IOException {
        JSONObject jsonObject;
        try {
            jsonObject = new JSONObject(flowJson);

            JSONUtils.trimText(jsonObject, "separator");
        }
        catch (IOException e) {
            throw new DataHubException("Unable to parse flow json string : " + e.getMessage());
        }

        if (!jsonObject.isExist("name") || StringUtils.isEmpty(jsonObject.getString("name"))) {
            throw new BadRequestException("Flow Name not provided. Flow Name is required.");
        }

        String flowName = jsonObject.getString("name");
        Flow flow = null;
        if (checkExists) {
            if (flowManager.isFlowExisted(flowName)) {
                throw new DataHubException("A Flow with " + flowName + " already exists.");
            }
            flow = new FlowImpl();
            flow.setName(flowName);
        }
        else {
            //for PUT updating
            flow = flowManager.getFlow(flowName);
            if (flow == null) {
                throw new DataHubException("Changing flow name not supported.");
            }
        }
        FlowStepModel.createFlowSteps(flow, jsonObject);
        flowManager.saveFlow(flow);

        FlowStepModel fsm = FlowStepModel.transformFromFlow(flow);

        Path dir = hubConfig.getFlowsDir();
        if (dir.toFile().exists()) {
            watcherService.watch(dir.toString());
        }
        if (checkExists) { //a new flow
            dataHubService.reinstallUserModules(hubConfig, null, null);
        }

        return fsm;
    }

    public FlowStepModel getFlow(String flowName, boolean fromRunFlow) {
        Flow flow = flowManager.getFlow(flowName);
        if (flow == null) {
            throw new NotFoundException(flowName + " not found!");
        }
        FlowStepModel fsm = asyncFlowService.getFlowStepModel(flow, fromRunFlow, null);
        return fsm;
    }

    public List<String> getFlowNames() {
        return flowManager.getFlowNames();
    }

    public void deleteFlow(String flowName) {
        flowManager.deleteFlow(flowName);
        dataHubService.deleteDocument("/flows/" + flowName + FLOW_FILE_EXTENSION, DatabaseKind.STAGING);
        dataHubService.deleteDocument("/flows/" + flowName + FLOW_FILE_EXTENSION, DatabaseKind.FINAL);
    }

    public List<StepModel> getSteps(String flowName) {
        Flow flow = flowManager.getFlow(flowName);
        Map<String, Step> stepMap = flow.getSteps();

        List<StepModel> stepModelList = new ArrayList<>();
        for (String key : stepMap.keySet()) {
            Step step = stepMap.get(key);
            StepModel stepModel = StepModel.transformToWebStepModel(step);
            stepModelList.add(stepModel);
        }

        return stepModelList;
    }

    public StepModel getStep(String flowName, String stepId) {
        Flow flow = flowManager.getFlow(flowName);
        if (flow == null) {
            throw new NotFoundException(flowName + " not found.");
        }

        Step step = flow.getStep(getStepKeyInStepMap(flow, stepId));
        if (step == null) {
            throw new NotFoundException(stepId + " not found.");
        }

        return StepModel.transformToWebStepModel(step);
    }

    public StepModel createStep(String flowName, Integer stepOrder, String stepId, String stringStep) {
        StepModel stepModel;
        JsonNode stepJson;
        Flow flow = flowManager.getFlow(flowName);
        Step existingStep = flow.getStep(getStepKeyInStepMap(flow, stepId));

        if (existingStep == null && !StringUtils.isEmpty(stepId)) {
            throw new NotFoundException("Step " + stepId + " Not Found");
        }

        try {
            stepJson = JSONObject.readInput(stringStep);

            JSONUtils.trimText(stepJson, "separator");

            stepModel = StepModel.fromJson(stepJson);
        }
        catch (IOException e) {
            throw new BadRequestException("Error parsing JSON");
        }

        if (stepModel == null) {
            throw new BadRequestException();
        }

        Step step = StepModel.transformToCoreStepModel(stepModel, stepJson);

        if (step.getStepDefinitionType() == null) {
            throw new BadRequestException("Invalid Step Definition Type");
        }

        if (step.getStepDefinitionName() == null) {
            throw new BadRequestException("Invalid Step Definition Name");
        }

        if (stepId != null) {
            if (!stepId.equals(step.getName() + "-" + step.getStepDefinitionType())) {
                throw new BadRequestException("Changing step name or step type not supported.");
            }
        }
        boolean invalidStepType = true;
        for (StepDefinition.StepDefinitionType stepType : StepDefinition.StepDefinitionType.values()) {
            if (stepType.equals(step.getStepDefinitionType())) {
                invalidStepType = false;
                break;
            }
        }
        if(invalidStepType) {
            throw new BadRequestException("Invalid Step Type");
        }
        step = upsertStepDefinition(stepModel, step);

        Map<String, Step> currSteps = flow.getSteps();
        if (stepId != null) {
            String key = getStepKeyInStepMap(flow, stepId);
            if (StringUtils.isNotEmpty(key)) {
                currSteps.put(key, step);
            }
            flow.setSteps(currSteps);
        }
        else {
            if (stepOrder == null || stepOrder > currSteps.size()) {
                currSteps.put(String.valueOf(currSteps.size() + 1), step);
            }
            else {
                Map<String, Step> newSteps = new LinkedHashMap<>();
                final Integer[] count = {1};
                Step finalStep = step;
                currSteps.values().forEach(s -> {
                    if (count[0].equals(stepOrder)) {
                        newSteps.put(String.valueOf(count[0]++), finalStep);
                    }
                    newSteps.put(String.valueOf(count[0]), s);
                    ++count[0];
                });
                flow.setSteps(newSteps);
            }
        }

        if (existingStep != null && existingStep.isEqual(step)) {
            return StepModel.transformToWebStepModel(existingStep);
        }

        flowManager.saveFlow(flow);
        return StepModel.transformToWebStepModel(step);
    }

    protected Step upsertStepDefinition(StepModel stepModel, Step step) {
        if (stepDefinitionManagerService.getStepDefinition(step.getStepDefinitionName(), step.getStepDefinitionType()) != null) {
            String stepType = step.getStepDefinitionType().toString().toLowerCase();
            if(step.getStepDefinitionName().equalsIgnoreCase("default-" + stepType)) {
                StepDefinition defaultStepDefinition = getDefaultStepDefinitionFromResources("hub-internal-artifacts/step-definitions/" + stepType + "/marklogic/default-"+ stepType +".step.json", step.getStepDefinitionType());
                Step defaultStep = defaultStepDefinition.transformToStep(step.getName(), defaultStepDefinition, new Step());
                step = StepModel.mergeFields(stepModel, defaultStep, step);
            }
            else {
                StepDefinition oldStepDefinition = stepDefinitionManagerService.getStepDefinition(step.getStepDefinitionName(), step.getStepDefinitionType());
                StepDefinition stepDefinition = oldStepDefinition.transformFromStep(oldStepDefinition, step);
                stepDefinitionManagerService.saveStepDefinition(stepDefinition);
            }
        }
        else {
            String stepDefName = step.getStepDefinitionName();
            StepDefinition.StepDefinitionType stepDefType = step.getStepDefinitionType();
            String modulePath = "/custom-modules/" + stepDefType.toString().toLowerCase() + "/" + stepDefName + "/main.sjs";

            StepDefinition stepDefinition = StepDefinition.create(stepDefName, stepDefType);
            stepDefinition = stepDefinition.transformFromStep(stepDefinition, step);

            scaffolding.createCustomModule(stepDefName, stepDefType.toString());
            stepDefinition.setModulePath(modulePath);
            step.setModulePath(modulePath);
            stepDefinitionManagerService.createStepDefinition(stepDefinition);
        }
        return step;
    }

    public void deleteStep(String flowName, String stepId) {
        Flow flow = flowManager.getFlow(flowName);
        String key = getStepKeyInStepMap(flow, stepId);

        if (StringUtils.isEmpty(key)) {
            throw new BadRequestException("Invalid Step Id");
        }

        try {
            flowManager.deleteStep(flow, key);
        }
        catch (DataHubProjectException e) {
            throw new NotFoundException(e.getMessage());
        }
    }

    public FlowStepModel runFlow(String flowName, List<String> steps) {
        RunFlowResponse resp = null;
        if (steps == null || steps.size() == 0) {
            resp = flowRunner.runFlow(flowName);
        }
        else {
            Flow flow = flowManager.getFlow(flowName);
            List<String> restrictedSteps = new ArrayList<>();
            steps.forEach((step) -> restrictedSteps.add(this.getStepKeyInStepMap(flow, step)));
            resp = flowRunner.runFlow(flowName, restrictedSteps);
        }
        return getFlow(flowName, true);
    }

    public FlowStepModel stop(String flowName) {
        List<String> jobIds = flowRunner.getQueuedJobIdsFromFlow(flowName);
        Iterator<String> itr = jobIds.iterator();
        if (!itr.hasNext()) {
            throw new BadRequestException("Flow not running.");
        }
        while (itr.hasNext()) {
            flowRunner.stopJob(itr.next());
        }
        return getFlow(flowName, false);
    }


    private String getStepKeyInStepMap(Flow flow, String stepId) {
        if (flow == null || StringUtils.isEmpty(stepId)) {
            return null;
        }

        // Split on the last occurrence of "-"
        String[] stepStr = stepId.split("-(?!.*-)");

        if (stepStr.length == 2) {
            String name = stepStr[0];
            String type = stepStr[1];
            String[] key = new String[1];

            flow.getSteps().forEach((k, v) -> {
                if (name.equals(v.getName()) && type.equalsIgnoreCase(v.getStepDefinitionType().toString())) {
                    key[0] = k;
                }
            });

            return key[0];
        }

        return null;
    }

    private StepDefinition getDefaultStepDefinitionFromResources(String resourcePath, StepDefinition.StepDefinitionType stepDefinitionType) {
        try {
            InputStream in = FlowManagerService.class.getClassLoader().getResourceAsStream(resourcePath);
            JSONObject jsonObject = new JSONObject(IOUtils.toString(in));
            StepDefinition defaultStep = StepDefinition.create(stepDefinitionType.toString(), stepDefinitionType);
            defaultStep.deserialize(jsonObject.jsonNode());

            return defaultStep;
        }
        catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
