/*
 * Copyright 2020 MarkLogic Corporation
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
package com.marklogic.hub.cloud.aws.glue.Writer;

import com.marklogic.client.ext.helper.LoggingObject;
import com.marklogic.hub.HubClient;
import com.marklogic.hub.impl.HubConfigImpl;
import com.marklogic.mgmt.util.SimplePropertySource;
import org.apache.spark.sql.catalyst.InternalRow;
import org.apache.spark.sql.sources.v2.writer.DataWriter;
import org.apache.spark.sql.sources.v2.writer.DataWriterFactory;
import org.apache.spark.sql.types.StructType;

import java.util.Map;
import java.util.Properties;

public class MarkLogicDataWriterFactory extends LoggingObject implements DataWriterFactory<InternalRow> {

    private StructType schema;
    private HubClient hubClient;
    private Map<String, String> params;

    /**
     * @param params a map of parameters containing both DHF-supported properties (most likely prefixed with ml* or
     *               hub*) and connector-specific properties. The DHF-supported properties will be used to construct a
     *               HubClient for communicating with MarkLogic.
     * @param schema
     */
    public MarkLogicDataWriterFactory(Map<String, String> params, StructType schema) {
        this.params = params;
        this.schema = schema;

        Properties props = new Properties();
        params.keySet().forEach(key -> props.setProperty(key, params.get(key)));
        logger.info("Creating HubClient for host: " + props.getProperty("mlHost"));
        HubConfigImpl hubConfig = new HubConfigImpl();
        hubConfig.registerLowerCasedPropertyConsumers();
        hubConfig.applyProperties(new SimplePropertySource(props));
        this.hubClient = hubConfig.newHubClient();
    }

    @Override
    public DataWriter<InternalRow> createDataWriter(int partitionId, long taskId, long epochId) {
        if (logger.isDebugEnabled()) {
            logger.debug("Creating DataWriter with taskId: " + taskId);
        }
        return new MarkLogicDataWriter(hubClient, taskId, schema, params);
    }
}
