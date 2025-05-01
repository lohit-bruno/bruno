import { createSlice } from '@reduxjs/toolkit';
import { find } from 'lodash';
import { uuid } from 'utils/common/index';

// workflows = [{
//   collectionUid: <collection.uid>,
//   uid: <uid>,
//   name: <name>,
//   items: [{
//     uid: <item.uid>,
//     type: <item.type>, // ['request', 'folder', 'script'];
//     itemUid: <item.uid>,
//     data: <item.data>, // text string
//   }]
// }]


const initialState = {
  workflows: [{
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_1',
    items: []
  },
  {
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_2',
    items: []
  },
  {
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_3',
    items: []
  },
  {
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_4',
    items: []
  },
  {
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_5',
    items: []
  }]
};

export const workflowsSlice = createSlice({
  name: 'workflows',
  initialState,
  reducers: {
    addWorkflow: (state, action) => {
      const { collectionUid, name = "", items = [] } = action.payload;
      const workflow = {
        collectionUid,
        uid: uuid(),
        name,
        items
      };
      state.workflows.push(workflow);
    },
    addItemToWorkflow: (state, action) => {
      const { collectionUid, workflowUid, itemUid, name, type } = action.payload;
      const workflow = find(state.workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
      console.log('workflow', JSON.stringify(state.workflows, null, 2), workflow, action.payload);
      if (workflow) {
        workflow.items?.push({
          uid: uuid(),
          itemUid,
          name,
          type
        });
      }
    },
    updateWorkflowItem: (state, action) => {
      const { collectionUid, workflowUid, workflowItemUid, data } = action.payload;
      const workflow = find(state.workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
      if (workflow) {
        workflow.items = workflow.items.map((i) => (i.uid === workflowItemUid) ? { ...i, data } : i);
      }
    },
    deleteWorkflowItem: (state, action) => {
      const { collectionUid, workflowUid, workflowItemUid } = action.payload;
      const workflow = find(state.workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
      if (workflow) {
        workflow.items = workflow.items.filter((i) => i.uid !== workflowItemUid);
      }
    }
  }
});

export const {
  addWorkflow,
  addItemToWorkflow,
  updateWorkflowItem,
  deleteWorkflowItem
} = workflowsSlice.actions;

export default workflowsSlice.reducer;