import { Application } from "../../../support/application.config";
import { tiles, toolbar } from "../../../support/components/common";
import {
  advancedSettingsDialog,
  createEditMappingDialog,
  sourceToEntityMap
} from '../../../support/components/mapping/index';
import loadPage from "../../../support/pages/load";
import browsePage from "../../../support/pages/browse";
import curatePage from "../../../support/pages/curate";
import runPage from "../../../support/pages/run";
import 'cypress-wait-until';

describe('Mapping', () => {

  beforeEach(() => {
    cy.visit('/');
    cy.contains(Application.title);
    cy.loginAsTestUserWithRoles("hub-central-flow-writer", "hub-central-mapping-writer", "hub-central-load-writer").withRequest();
    cy.waitUntil(() => toolbar.getCurateToolbarIcon()).click();
    cy.waitUntil(() => curatePage.getEntityTypePanel('Customer').should('be.visible'));
  });

  afterEach(() => {
    cy.resetTestUser();
  })

  after(() => {
    cy.loginAsDeveloper().withRequest();
    cy.deleteSteps('ingestion', 'loadOrderProcessor');
    cy.deleteSteps('mapping', 'mapOrderProcessor');
    cy.deleteFlows( 'orderFlow');
  })

  it('can create load step with processors, can create mapping step with processors, can create new flow, run both steps, and verify processors', () => {
    const flowName = 'orderFlow'
    const loadStep = 'loadOrderProcessor';
    const mapStep = 'mapOrderProcessor';
    // create load step
    toolbar.getLoadToolbarIcon().click();
    cy.waitUntil(() => loadPage.stepName('ingestion-step').should('be.visible'));
    loadPage.addNewButton('card').click();
    loadPage.stepNameInput().type(loadStep);
    loadPage.stepDescriptionInput().type('load order with processors');
    loadPage.confirmationOptions('Save').click();
    cy.findByText(loadStep).should('be.visible');
    loadPage.stepSettings(loadStep).click();

    // add processor to load step
    advancedSettingsDialog.setStepProcessor('loadTile/orderCategoryCodeProcessor');
    advancedSettingsDialog.saveSettings(loadStep).click();
    advancedSettingsDialog.saveSettings(loadStep).should('not.be.visible');
    
    // add step to new flow
    loadPage.addStepToNewFlow(loadStep);
    cy.findByText('New Flow').should('be.visible');
    runPage.setFlowName(flowName);
    runPage.setFlowDescription(`${flowName} description`);
    loadPage.confirmationOptions('Save').click();
    cy.verifyStepAddedToFlow('Load', loadStep);

    //Run the ingest with JSON
    runPage.runStep(loadStep).click();
    cy.uploadFile('input/10259.json');
    cy.verifyStepRunResult('success','Ingestion', loadStep);
    tiles.closeRunMessage().click();

    // create mapping step
    toolbar.getCurateToolbarIcon().click();
    cy.waitUntil(() => curatePage.getEntityTypePanel('Customer').should('be.visible'));
    curatePage.toggleEntityTypeId('Order');
    cy.waitUntil(() => curatePage.addNewMapStep().click());

    createEditMappingDialog.setMappingName(mapStep);
    createEditMappingDialog.setMappingDescription('An order mapping with custom processors');
    createEditMappingDialog.setSourceRadio('Query');
    createEditMappingDialog.setQueryInput(`cts.collectionQuery(['${loadStep}'])`)
    createEditMappingDialog.saveButton().click(); 
    curatePage.verifyStepNameIsVisible(mapStep);

    // add processors
    curatePage.stepSettings(mapStep).click();
    advancedSettingsDialog.setStepProcessor('curateTile/orderDateProcessor');
    advancedSettingsDialog.saveSettings(mapStep).click();
    advancedSettingsDialog.saveSettings(mapStep).should('not.be.visible');

    // map source to entity
    curatePage.openSourceToEntityMap('Order', mapStep);
    cy.waitUntil(() => sourceToEntityMap.expandCollapseEntity().should('be.visible')).click();
    sourceToEntityMap.setXpathExpressionInput('orderId', 'OrderID');
    sourceToEntityMap.setXpathExpressionInput('address', '/');
    sourceToEntityMap.setXpathExpressionInput('city', 'ShipCity');
    sourceToEntityMap.setXpathExpressionInput('state', 'ShipAddress');
    sourceToEntityMap.setXpathExpressionInput('orderDetails', '/');
    sourceToEntityMap.setXpathExpressionInput('productID', 'OrderDetails/ProductID');
    sourceToEntityMap.setXpathExpressionInput('unitPrice', 'head(OrderDetails/UnitPrice)');
    sourceToEntityMap.setXpathExpressionInput('quantity', 'OrderDetails/Quantity');
    sourceToEntityMap.setXpathExpressionInput('discount', 'head(OrderDetails/Discount)');
    sourceToEntityMap.setXpathExpressionInput('shipRegion', 'ShipRegion');
    sourceToEntityMap.setXpathExpressionInput('shippedDate', 'ShippedDate');
    // close modal
    cy.get('body').type('{esc}');

    curatePage.openExistingFlowDropdown('Order', mapStep);
    curatePage.getExistingFlowFromDropdown(flowName).click();
    curatePage.addStepToFlowConfirmationMessage(mapStep, flowName);
    curatePage.confirmAddStepToFlow(mapStep, flowName)

    runPage.runStep(mapStep).click();
    cy.verifyStepRunResult('success','Mapping', mapStep);
    runPage.explorerLink().click()
    browsePage.getTableViewSourceIcon().click();
    cy.contains('mappedOrderDate');
    cy.contains('categoryCode');
  })
})
