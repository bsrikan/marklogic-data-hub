class RunPage {

    createFlowButton() {
        return cy.findByText('Create Flow').closest('button');
    }

    toggleFlowConfig(flowName: string) {
        cy.waitUntil(() => cy.findByText(flowName).closest('div')).click();
        cy.waitUntil(() => cy.contains('Map'));
    }

    getFlowName(flowName: string) {
        return cy.findByText(flowName);
    }

    editSave() {
        return cy.findByLabelText('Save');
    }

    editCancel() {
        return cy.findByLabelText('Cancel');
    }

    setFlowName(flowName: string) {
        cy.findByPlaceholderText('Enter name').type(flowName);
    }

    setFlowDescription(flowDesc: string) {
        cy.findByPlaceholderText('Enter description').type(flowDesc);
    }

    newFlowModal() {
        return cy.findByText('New Flow');
    }

    runStep(stepName: string) {
        return cy.findByLabelText(`runStep-${stepName}`);
    }

    runLastStepInAFlow(stepName: string) {
        return cy.findAllByLabelText(`runStep-${stepName}`);
    }

    deleteStep(stepName: string) {
        return cy.findByLabelText(`deleteStep-${stepName}`);
    }

    deleteStepDisabled(stepName: string) {
        return cy.findByLabelText(`deleteStepDisabled-${stepName}`);
    }

    deleteFlow(flowName: string) {
        return cy.findByTestId(`deleteFlow-${flowName}`);
    }

    deleteFlowDisabled(flowName: string) {
        return cy.findByLabelText(`deleteFlowDisabled-${flowName}`);
    }

    deleteFlowConfirmationMessage(flowName: string) {
        return cy.findByText(`Are you sure you want to delete flow "${flowName}"?`)
    }

    deleteStepConfirmationMessage(stepName: string, flowName: string) {
        return cy.findByText(`Are you sure you want to delete step "${stepName}" from flow "${flowName}"?`)
    }

    explorerLink() {
      return cy.findByTestId('explorer-link')
    }
}

const runPage = new RunPage();
export default runPage;
