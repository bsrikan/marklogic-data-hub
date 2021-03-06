/*
 * Copyright 2012-2020 MarkLogic Corporation
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */
package com.marklogic.hub.central.controllers;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.marklogic.hub.central.managers.MapSearchManager;
import com.marklogic.hub.central.models.MapSearchQuery;
import com.marklogic.hub.central.models.SJSSearchQuery;
import io.swagger.annotations.ApiOperation;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping(value = "/api/map-search")
public class MapSearchController extends BaseController {

    @RequestMapping(method = RequestMethod.POST)
    @ResponseBody
    @ApiOperation("Returns a MarkLogic JSON search response")
    public String search(@RequestBody MapSearchQuery mapSearchQuery) throws JsonProcessingException {
        return new MapSearchManager(getHubClient()).search(mapSearchQuery).get();
    }

    @RequestMapping(value = "/sjsSearch", method = RequestMethod.POST)
    @ResponseBody
    @ApiOperation("Returns a MarkLogic JSON search response")
    public JsonNode sjsSearch(@RequestBody SJSSearchQuery sjsSearchQuery) {
        return new MapSearchManager(getHubClient()).sjsSearch(sjsSearchQuery);
    }

    @RequestMapping(value = "/doc", method = RequestMethod.GET)
    @ResponseBody
    @ApiOperation("Returns a document as a string of JSON or XML")
    public ResponseEntity<String> getDoc(@RequestParam String database, @RequestParam String docUri) {
        HttpHeaders headers = new HttpHeaders();
        String body = new MapSearchManager(getHubClient()).getDoc(database, docUri);
        if (body.startsWith("<")) {
            headers.setContentType(MediaType.APPLICATION_XML);
        }
        else {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }
        return new ResponseEntity<>(body, headers, HttpStatus.OK);
    }
}
