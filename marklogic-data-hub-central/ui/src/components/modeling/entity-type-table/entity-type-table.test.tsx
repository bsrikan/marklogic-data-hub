import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { render, wait, screen, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import EntityTypeTable from './entity-type-table';

import { 
  entityReferences,
  deleteEntity,
  updateEntityModels
} from '../../../api/modeling';

import { 
  getEntityTypes,
  referencePayloadEmpty,
  referencePayloadRelationships,
  referencePayloadSteps 
} from '../../../assets/mock-data/modeling';

import { ConfirmationType } from '../../../types/modeling-types';
import { ModelingContext } from '../../../util/modeling-context';
import { isModified } from '../../../assets/mock-data/modeling-context-mock';

jest.mock('../../../api/modeling');

const mockEntityReferences = entityReferences as jest.Mock;
const mockDeleteEntity = deleteEntity as jest.Mock;
const mockUpdateEntityModels = updateEntityModels as jest.Mock;

describe('EntityTypeModal Component', () => {

  afterEach(() => {
    jest.clearAllMocks();
  })

  test('Table renders with empty array prop', () => {
    const { getByText } =  render(
      <Router>
        <EntityTypeTable 
          allEntityTypesData={[]}
          canReadEntityModel={true}
          canWriteEntityModel={true}
          autoExpand=''
          editEntityTypeDescription={jest.fn()}
          updateEntities={jest.fn()}
          revertAllEntity={false}
          toggleRevertAllEntity={jest.fn()}
          updateSavedEntity={jest.fn()}
        />
      </Router>);

    expect(getByText('Name')).toBeInTheDocument();
    expect(getByText('Instances')).toBeInTheDocument();
    expect(getByText('Last Processed')).toBeInTheDocument();
  });

  test('Table renders with mock data, no writer role', () => {
    const { getByText, getByTestId, getAllByRole, getByLabelText } =  render(
      <Router>
        <EntityTypeTable 
          allEntityTypesData={getEntityTypes}
          canReadEntityModel={true}
          canWriteEntityModel={false}
          autoExpand=''
          editEntityTypeDescription={jest.fn()}
          updateEntities={jest.fn()}
          revertAllEntity={false}
          toggleRevertAllEntity={jest.fn()}
          updateSavedEntity={jest.fn()}
        />
      </Router>);

    expect(getByText(/Customer/i)).toBeInTheDocument();
    expect(getByText(/1,000/i)).toBeInTheDocument();
    expect(getByTestId('Customer-last-processed')).toBeInTheDocument();

    expect(getByTestId('Customer-save-icon')).toHaveClass('iconSaveReadOnly');
    expect(getByTestId('Customer-revert-icon')).toHaveClass('iconRevertReadOnly');
    expect(getByTestId('Customer-trash-icon')).toHaveClass('iconTrashReadOnly');

    expect(getByText(/Order/i)).toBeInTheDocument();
    expect(getByText(/2,384/i)).toBeInTheDocument();
    expect(getByTestId('Order-last-processed')).toBeInTheDocument();

    // Verify sorting doesn't crash the component
    userEvent.click(getByText('Name'));
    userEvent.click(getByText('Last Processed'));
    userEvent.click(getByText('Instances'));

    const anotherModelExpandIcon = getByTestId('mltable-expand-AnotherModel');
    userEvent.click(within(anotherModelExpandIcon).getByRole('img'));

    expect(getByLabelText('AnotherModel-add-property')).toBeDisabled();
  });

  test('Table renders with mock data, with writer role, with auto expanded entity, and can click edit', () => {
    const editMock = jest.fn();
    const { getByTestId, getByLabelText } =  render(
      <Router>
        <EntityTypeTable 
          allEntityTypesData={getEntityTypes}
          canReadEntityModel={true}
          canWriteEntityModel={true}
          autoExpand='Order'
          editEntityTypeDescription={editMock}
          updateEntities={jest.fn()}
          revertAllEntity={false}
          toggleRevertAllEntity={jest.fn()}
          updateSavedEntity={jest.fn()}
        />
      </Router>);

    // Add back once functionality is added
    expect(getByTestId('Order-save-icon')).not.toHaveClass('iconSave');
    //expect(getByTestId('Order-revert-icon')).toHaveClass('iconRevert');
    expect(getByTestId('Order-trash-icon')).toHaveClass('iconTrash');

    userEvent.click(getByTestId('Order-span'));
    expect(editMock).toBeCalledTimes(1);
  });

  test('Table can mock delete entity', async () => {
    mockEntityReferences.mockResolvedValueOnce({ status: 200, data: referencePayloadEmpty });
    mockDeleteEntity.mockResolvedValueOnce({ status: 200 });

    const updateMock = jest.fn();

    const { getByTestId, getByLabelText, getByText, debug } =  render(
      <Router>
        <EntityTypeTable 
          allEntityTypesData={getEntityTypes}
          canReadEntityModel={true}
          canWriteEntityModel={true}
          autoExpand=''
          editEntityTypeDescription={jest.fn()}
          updateEntities={updateMock}
          revertAllEntity={false}
          toggleRevertAllEntity={jest.fn()}
          updateSavedEntity={jest.fn()}
        />
      </Router>);

      userEvent.click(getByTestId('Order-trash-icon'));
      expect(mockEntityReferences).toBeCalledWith('Order');
      expect(mockEntityReferences).toBeCalledTimes(1);

      await wait(() =>
        expect(screen.getByLabelText('delete-text')).toBeInTheDocument(),
      )

      userEvent.click(screen.getByLabelText(`confirm-${ConfirmationType.DeleteEntity}-yes`));

      expect(mockDeleteEntity).toBeCalledTimes(1);
  });

  test('Table can mock delete relationship entity', async () => {
    mockEntityReferences.mockResolvedValueOnce({ status: 200, data: referencePayloadRelationships });
    mockDeleteEntity.mockResolvedValueOnce({ status: 200 });

    const updateMock = jest.fn();

    const { getByTestId, getByLabelText, getByText } =  render(
      <Router>
        <EntityTypeTable 
          allEntityTypesData={getEntityTypes}
          canReadEntityModel={true}
          canWriteEntityModel={true}
          autoExpand=''
          editEntityTypeDescription={jest.fn()}
          updateEntities={updateMock}
          revertAllEntity={false}
          toggleRevertAllEntity={jest.fn()}
          updateSavedEntity={jest.fn()}
        />
      </Router>);

      userEvent.click(getByTestId('Product-trash-icon'));
      expect(mockEntityReferences).toBeCalledWith('Product');
      expect(mockEntityReferences).toBeCalledTimes(1);

      await wait(() =>
        expect(screen.getByLabelText('delete-relationship-text')).toBeInTheDocument()
      )
      expect(screen.getByText('Existing entity type relationships.')).toBeInTheDocument();
      userEvent.click(screen.getByLabelText(`confirm-${ConfirmationType.DeleteEntityRelationshipWarn}-yes`));
      expect(mockDeleteEntity).toBeCalledTimes(1)
  });

  test('can show confirm modal for delete steps', async () => {
    mockEntityReferences.mockResolvedValueOnce({ status: 200, data: referencePayloadSteps });
    mockDeleteEntity.mockResolvedValueOnce({ status: 200 });

    const updateMock = jest.fn();

    const { getByTestId, getByLabelText, getByText } =  render(
      <Router>
        <EntityTypeTable 
          allEntityTypesData={getEntityTypes}
          canReadEntityModel={true}
          canWriteEntityModel={true}
          autoExpand=''
          editEntityTypeDescription={jest.fn()}
          updateEntities={updateMock}
          revertAllEntity={false}
          toggleRevertAllEntity={jest.fn()}
          updateSavedEntity={jest.fn()}
        />
      </Router>);

      userEvent.click(getByTestId('Product-trash-icon'));
      expect(mockEntityReferences).toBeCalledWith('Product');
      expect(mockEntityReferences).toBeCalledTimes(1);

      await wait(() =>
        expect(screen.getByLabelText('delete-step-text')).toBeInTheDocument()
      )
      expect(screen.getByText('Entity type is used in one or more steps.')).toBeInTheDocument();
      userEvent.click(screen.getByLabelText(`confirm-${ConfirmationType.DeleteEntityStepWarn}-close`));
      expect(mockDeleteEntity).toBeCalledTimes(0)
  });

  test('Table can mock save an entity', async () => {
    mockUpdateEntityModels.mockResolvedValueOnce({ status: 200 });

    const { getByTestId, getByLabelText, getByText, debug } =  render(
      <Router>
        <ModelingContext.Provider value={isModified}>  
          <EntityTypeTable 
            allEntityTypesData={getEntityTypes}
            canReadEntityModel={true}
            canWriteEntityModel={true}
            autoExpand=''
            editEntityTypeDescription={jest.fn()}
            updateEntities={jest.fn()}
            revertAllEntity={false}
            toggleRevertAllEntity={jest.fn()}
            updateSavedEntity={jest.fn()}
          />
        </ModelingContext.Provider>
      </Router>);

      userEvent.click(getByTestId('Order-save-icon'));

      await wait(() =>
        expect(screen.getByLabelText('save-text')).toBeInTheDocument(),
      )
      userEvent.click(screen.getByLabelText(`confirm-${ConfirmationType.SaveEntity}-yes`));
      expect(mockUpdateEntityModels).toBeCalledTimes(1);
  });

  test('Table can mock revert an entity', async () => {
    mockUpdateEntityModels.mockResolvedValueOnce({ status: 200 });

    const { getByTestId } =  render(
      <Router>
        <ModelingContext.Provider value={isModified}>  
          <EntityTypeTable
            allEntityTypesData={getEntityTypes}
            canReadEntityModel={true}
            canWriteEntityModel={true}
            autoExpand=''
            editEntityTypeDescription={jest.fn()}
            updateEntities={jest.fn()}
            revertAllEntity={false}
            toggleRevertAllEntity={jest.fn()}
            updateSavedEntity={jest.fn()}
          />
        </ModelingContext.Provider>
      </Router>);

    userEvent.click(getByTestId('Order-revert-icon'));

    await wait(() =>
      expect(screen.getByLabelText('revert-text')).toBeInTheDocument(),
    )
  });

  test('Table can mock delete entity with no relations and outstanding edits', async () => {
    mockEntityReferences.mockResolvedValueOnce({ status: 200, data: referencePayloadEmpty });
    mockUpdateEntityModels.mockResolvedValueOnce({ status: 200 });

    const { getByTestId } =  render(
      <ModelingContext.Provider value={isModified}>
      <Router>
        <EntityTypeTable
          allEntityTypesData={getEntityTypes}
          canReadEntityModel={true}
          canWriteEntityModel={true}
          autoExpand=''
          editEntityTypeDescription={jest.fn()}
          updateEntities={jest.fn()}
          revertAllEntity={false}
          toggleRevertAllEntity={jest.fn()}
          updateSavedEntity={jest.fn()}
        />
      </Router>
      </ModelingContext.Provider>
    );

    userEvent.click(getByTestId('Product-trash-icon'));
    expect(mockEntityReferences).toBeCalledWith('Product');
    expect(mockEntityReferences).toBeCalledTimes(1);

    await wait(() =>
      expect(screen.getByLabelText('delete-no-relationship-edit-text')).toBeInTheDocument(),
  )
    userEvent.click(screen.getByLabelText(`confirm-${ConfirmationType.DeleteEntityNoRelationshipOutstandingEditWarn}-yes`));
    expect(mockUpdateEntityModels).toBeCalledTimes(1);
  });

  test('Table can mock delete entity with relations and outstanding edits', async () => {
    mockUpdateEntityModels.mockResolvedValueOnce({ status: 200 });
    mockEntityReferences.mockResolvedValueOnce({ status: 200, data: referencePayloadRelationships });

    const { getByTestId } =  render(
      <ModelingContext.Provider value={isModified}>
        <Router>
          <EntityTypeTable
            allEntityTypesData={getEntityTypes}
            canReadEntityModel={true}
            canWriteEntityModel={true}
            autoExpand=''
            editEntityTypeDescription={jest.fn()}
            updateEntities={jest.fn()}
            revertAllEntity={false}
            toggleRevertAllEntity={jest.fn()}
            updateSavedEntity={jest.fn()}
          />
        </Router>
      </ModelingContext.Provider>
    );

    userEvent.click(getByTestId('Order-trash-icon'));
    expect(mockEntityReferences).toBeCalledWith('Order');
    expect(mockEntityReferences).toBeCalledTimes(1);

    await wait(() =>
      expect(screen.getByLabelText('delete-relationship-edit-text')).toBeInTheDocument(),
    )
    userEvent.click(screen.getByLabelText(`confirm-${ConfirmationType.DeleteEntityRelationshipOutstandingEditWarn}-yes`));
    expect(mockUpdateEntityModels).toBeCalledTimes(1);
  });
});

