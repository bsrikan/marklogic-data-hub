const test = require("/test/test-helper.xqy");
const Artifacts = require('/data-hub/5/artifacts/core.sjs');

function invokeSetService(artifactType, artifactName, artifact) {
    return fn.head(xdmp.invoke(
        "/data-hub/5/data-services/artifacts/setArtifact.sjs",
        {artifactType, artifactName, artifact: xdmp.toJSON(artifact)}
    ));
}

function invokeGetAllService(artifactType) {
    return fn.head(xdmp.invoke(
        "/data-hub/5/data-services/artifacts/getList.sjs",
        {artifactType}
    ));
}

function invokeValidateService(artifactType, artifactName, artifact) {
  return Artifacts.validateArtifact(artifactType, artifactName, artifact);
}

function updateMappingConfig(artifactName) {
    const result = invokeSetService('mapping', artifactName, {'name': `${artifactName}`, 'targetEntityType': 'TestEntity-hasMappingConfig', 'description': 'Mapping does ...', 'selectedSource': 'query', 'sourceQuery': 'cts.collectionQuery(\"default-ingestion\")', 'collections': ['RAW-COL']});
    return [
        test.assertEqual(artifactName, result.name),
        test.assertEqual("TestEntity-hasMappingConfig", result.targetEntityType),
        test.assertEqual(100, result.batchSize)
    ];
}

function createMappingWithSameNameButDifferentEntityType(artifactName) {
  try {
    invokeSetService('mapping', artifactName, {'name': `${artifactName}`, 'targetEntityType': 'TestEntity-NoMappingConfig', 'selectedSource': 'query'});
    return new Error("Expected a failure because another mapping exists with the same name but a different entity type. " +
      "Mapping names must be globally unique.");
  } catch (e) {
    let msg = e.data[2];
    return test.assertEqual("A mapping with the same name but for a different entity type already exists. Please choose a different name.", msg);
  }
}

function getArtifacts() {
    const artifactsByEntity = invokeGetAllService('mapping');
    test.assertEqual(2, artifactsByEntity.length,
      "Should be an entry for each entity type, even if there are no mappings for a type");
    artifactsByEntity.forEach(entity => {
        if (entity.entityType === 'TestEntity-hasMappingConfig') {
            const artifacts = entity.artifacts;
            artifacts.forEach(mapping => {
                if (mapping.name == 'TestMapping' || mapping.name === 'TestMapping2') {
                    test.assertEqual("TestEntity-hasMappingConfig", mapping.targetEntityType);
                    test.assertTrue(xdmp.castableAs('http://www.w3.org/2001/XMLSchema', 'dateTime', mapping.lastUpdated));
                }
            })
        }
    });
}

function validArtifact() {
    const result = invokeValidateService('mapping','validMapping', { name: 'validMapping', targetEntityType: 'TestEntity-hasMappingConfig', selectedSource: 'collection'});
    return [
        test.assertEqual("validMapping", result.name),
        test.assertEqual("TestEntity-hasMappingConfig", result.targetEntityType),
        test.assertEqual("collection", result.selectedSource)
    ];
}

function invalidArtifact() {
    try {
        const result = invokeValidateService('mapping', "invalidMapping", { name: 'invalidMapping'});
        return [test.assertTrue(false, 'Should have thrown a validation error')];
    } catch (e) {
        let msg = e.data[2];
        return [
            test.assertEqual(3, e.data.length, `Error doesn't have the expected validate information: "${JSON.stringify(e)}"`),
            test.assertTrue(fn.contains(msg, 'required'), `Message: "${msg}" doesn't have "required"`),
            test.assertTrue(fn.contains(msg, 'targetEntityType'), `Message: "${msg}" doesn't have "targetEntityType"`),
            test.assertTrue(fn.contains(msg, 'selectedSource'), `Message: "${msg}" doesn't have "selectedSource"`),
            test.assertFalse(fn.contains(msg, 'name'), `Message: "${msg}" has "name" when it shouldn't`)
        ];
    }
}

[]
    .concat(updateMappingConfig('TestMapping'))
    .concat(createMappingWithSameNameButDifferentEntityType('TestMapping'))
    .concat(updateMappingConfig('TestMapping2'))
    .concat(getArtifacts())
    .concat(validArtifact())
    .concat(invalidArtifact());
