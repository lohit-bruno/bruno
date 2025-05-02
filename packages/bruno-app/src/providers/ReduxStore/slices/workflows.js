import { createSlice } from '@reduxjs/toolkit';
import { cloneDeep, find } from 'lodash';
import { findCollectionByUid, findEnvironmentInCollection, findWorkflowByUid, getEnvVars, getGlobalEnvironmentVariables } from 'utils/collections/index';
import { uuid } from 'utils/common/index';

const initialState = {
  workflows: [{
    collectionUid: '1rm40pw00000000000000',
    uid: uuid(),
    name: 'test_workflow_1',
    nodes: [{
      id: 'start_node',
      type: 'startNode',
      name: 'Start',
      position: {
        x: 10,
        y: 10,
      }
    },{
      id: 'end_node',
      type: 'endNode',
      name: 'End',
      position: {
        x: 500,
        y: 10,
      }
    }],
    edges: []
  },{
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_1',
    nodes: [{
      id: 'start_node',
      type: 'startNode',
      name: 'Start',
      position: {
        x: 10,
        y: 10,
      }
    },{
      id: 'end_node',
      type: 'endNode',
      name: 'End',
      position: {
        x: 500,
        y: 10,
      }
    }],
    edges: []
  },
  {
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_2',
    nodes: [{
      id: 'start_node',
      type: 'startNode',
      name: 'Start',
      position: {
        x: 10,
        y: 10,
      }
    },{
      id: 'end_node',
      type: 'endNode',
      name: 'End',
      position: {
        x: 500,
        y: 10,
      }
    }],
    edges: []
  },
  {
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_3',
    nodes: [{
      id: 'start_node',
      type: 'startNode',
      name: 'Start',
      position: {
        x: 10,
        y: 10,
      }
    },{
      id: 'end_node',
      type: 'endNode',
      name: 'End',
      position: {
        x: 500,
        y: 10,
      }
    }],
    edges: []
  },
  {
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_4',
    nodes: [{
      id: 'start_node',
      type: 'startNode',
      name: 'Start',
      position: {
        x: 10,
        y: 10,
      }
    },{
      id: 'end_node',
      type: 'endNode',
      name: 'End',
      position: {
        x: 500,
        y: 10,
      }
    }],
    edges: []
  },
  {
    collectionUid: '1fbu88200000000000000',
    uid: uuid(),
    name: 'test_workflow_5',
    nodes: [{
      id: 'start_node',
      type: 'startNode',
      name: 'Start',
      position: {
        x: 10,
        y: 10,
      }
    },{
      id: 'end_node',
      type: 'endNode',
      name: 'End',
      position: {
        x: 500,
        y: 10,
      }
    }],
    edges: []
  }]
};

export const workflowsSlice = createSlice({
  name: 'workflows',
  initialState,
  reducers: {
    addWorkflow: (state, action) => {
      const { collectionUid, name = "", nodes = [], edges = [] } = action.payload;
      const workflow = {
        collectionUid,
        uid: uuid(),
        name,
        nodes,
        edges
      };
      state.workflows.push(workflow);
    },
    addNodeToWorkflow: (state, action) => {
      const { collectionUid, workflowUid, workflowNode } = action.payload;
      const workflow = find(state.workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
      if (workflow) {
        workflow.nodes?.push(workflowNode);
      }
    },
    updateWorkflowNodes: (state, action) => {
      const { collectionUid, workflowUid, workflowNodes } = action.payload;
      const workflow = find(state.workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
      if (workflow) {
        workflow.nodes = workflowNodes;
      }
    },
    updateworkflowNodeEdges: (state, action) => {
      const { collectionUid, workflowUid, workflowNodeEdges } = action.payload;
      const workflow = find(state.workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
      if (workflow) {
        workflow.edges = workflowNodeEdges;
      }
    },
    deleteWorkflowNode: (state, action) => {
      const { collectionUid, workflowUid, workflowNodeUid } = action.payload;
      const workflow = find(state.workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
      if (workflow) {
        workflow.nodes = workflow.nodes.filter((i) => i.id !== workflowNodeUid);
      }
    },
    updateWorkflowNodeContent: (state, action) => {
      const { collectionUid, workflowUid, workflowNodeUid, content } = action.payload;
      const workflow = find(state.workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
      const workflowNode = find(workflow.nodes, (n) => n.id === workflowNodeUid);
      if (workflowNode?.data) {
        workflowNode.data.content = content;
      }
    },
    runWorkflowEvent: (state, action) => {
      const { collectionUid, workflowUid, workflowNodeUid, itemUid, type, isRecursive, error, cancelTokenUid } = action.payload;
      const workflow = findWorkflowByUid({ collectionUid, workflows: state.workflows, workflowUid });

      console.log({ workflowUid, workflow, ...action.payload });

      if (workflow) {
        const workflowNode = find(workflow.nodes, n => n?.id == workflowNodeUid);

        if (!workflowNode) {
          // check pre post script
          return;
        }

        workflowNode.data.executionResult = workflowNode?.data?.executionResult || { info: {}, results: [] };

        console.log({ workflowNode });

        const info = workflowNode.data.executionResult.info;
        const results = workflowNode.data.executionResult.results;
        const currentResult = results.findLast(r => r.itemUid == itemUid);

        console.log("tpyeee", type, JSON.stringify(currentResult));

        if (!currentResult) {
          results.push({
            itemUid,
            status: 'queued',
            cancelTokenUid
          });
        }

        if (type === 'pre-request-script-execution') {
          currentResult.status = "sending";
          currentResult.preRequestScriptErrorMessage = action.payload.errorMessage;
        }

        if(type === 'post-response-script-execution') {
          currentResult.status = "sending";
          currentResult.postResponseScriptErrorMessage = action.payload.errorMessage;
        }

        if (type === 'request-sent') {
          const { requestSent } = action.payload;
          currentResult.status = "sending";
          currentResult.requestSent = requestSent;
        }

        if (type === 'assertion-results') {
          const { results } = action.payload;
          currentResult.status = "sending";
          currentResult.assertionResults = results;
        }

        if (type === 'test-results') {
          const { results } = action.payload;
          currentResult.status = "sending";
          currentResult.testResults = results;
        }

        if (type === 'testrun-started') {
          info.cancelTokenUid = cancelTokenUid;
          currentResult.status = "sending";
          currentResult.status = 'started';
        }

        if (type === 'testrun-ended') {
          currentResult.status = 'ended';
          if (action.payload.statusText) {
            info.statusText = action.payload.statusText;
          }
        }

        if (type === 'response-received') {
          currentResult.status = 'ended';

          if (action.payload.responseReceived) {
            if (action.payload.responseReceived?.error) {
              currentResult.status = 'error';
            }
            currentResult.responseReceived = action.payload.responseReceived;
          }
        }
      }
    }
  }
});

export const {
  addWorkflow,
  addNodeToWorkflow,
  updateWorkflowNodes,
  updateworkflowNodeEdges,
  deleteWorkflowNode,
  updateWorkflowNodeContent,
  runWorkflowEvent
} = workflowsSlice.actions;


export const runWorkflow = ({ collectionUid, workflowUid }) => (dispatch, getState) => {
  return new Promise(async (resolve, reject) => {
    const state = getState();
    const workflows = state.workflows.workflows;
    const workflow = find(workflows, (w) => w.collectionUid === collectionUid && w.uid === workflowUid);
    const { nodes: workflowNodes, edges: workflowNodeEdges } = workflow;

    const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;
    const collection = findCollectionByUid(state.collections.collections, collectionUid);

    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    let collectionCopy = cloneDeep(collection);
    const globalEnvironmentVariables = getGlobalEnvironmentVariables({ globalEnvironments, activeGlobalEnvironmentUid });
    collectionCopy.globalEnvironmentVariables = globalEnvironmentVariables;
    const environment = findEnvironmentInCollection(collectionCopy, collection.activeEnvironmentUid);
    const envVariables = getEnvVars(environment);
    const variables = {
      envVariables,
      runtimeVariables: collectionCopy.runtimeVariables,
    }

    const activeWorkflowNodes = workflowNodeEdges?.map(e => workflowNodes?.find(w => w.id == e.target))?.filter(Boolean);

    console.log(activeWorkflowNodes?.map(w => w.name));

    const { ipcRenderer } = window;
    ipcRenderer
      .invoke('run-workflow', { collection: collectionCopy, variables, workflowUid, workflowNodes: activeWorkflowNodes })
      .then(res => {
        console.log(res);
        resolve(res);
      })
      .catch(reject);
  });
};

export default workflowsSlice.reducer;