import { useRef, useCallback, useMemo, useState } from 'react';
import { useDrop } from 'react-dnd';
import {
  ReactFlow,
  Background,
  useEdgesState,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { IconPlus, Icon } from '@tabler/icons';
import PencilBoltIcon from 'components/Icons/PencilBolt/index';

import { toggleTabLock } from 'providers/ReduxStore/slices/tabs';
import { addNodeToWorkflow, runWorkflow, updateWorkflowNodeContent, updateworkflowNodeEdges, updateWorkflowNodes } from 'providers/ReduxStore/slices/workflows';

import ScriptNode from '../CustomNodes/Script';
import RequestNode from '../CustomNodes/Request';
import FolderNode from '../CustomNodes/Folder';
import StartNode from '../CustomNodes/Start';
import EndNode from '../CustomNodes/End';
import { uuid } from 'utils/common/index';
import cloneDeep from 'lodash/cloneDeep';

const StyledWrapper = styled.div`
  width: 100%;
  height: 100%;
  background: ${props => props.theme.colors.background};
  font-size: 13px;
`;

const WorkflowEditor = ({ collectionUid, workflowUid }) => {
  const dispatch = useDispatch();
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const activeTab = useSelector((state) => state.tabs.tabs.find((tab) => tab.uid === activeTabUid));
  const workflow = useSelector((state) => state.workflows.workflows.find((workflow) => workflow.uid === workflowUid));

  const [isPreviewMode, setIsPreviewMode] = useState(true);

  const reactFlowWrapper = useRef(null);
  const reactFlowRef = useRef(null);
  const workflowNodes = useMemo(() => {
    return cloneDeep(workflow?.nodes) || [];
  }, [workflow]);

  const workflowNodeEdges = useMemo(() => {
    return cloneDeep(workflow?.edges) || [];
  }, [workflow]);

  const [{ isOver }, drop] = useDrop({
    accept: `collection-item-${collectionUid}`,
    drop: (draggedItem, monitor) => {
      const { x: clientOffsetX, y: clientOffsetY } = monitor.getClientOffset();
      const { left: leftOffset, top: topOffset } = reactFlowWrapper.current.getBoundingClientRect()
      if (isPreviewMode) return;
      const { uid: itemUid, name, type } = draggedItem;
      const workflowNodeUid = uuid();
      const workflowNode = {
        id: workflowNodeUid,
        type: type === 'folder' ? 'folderNode' : 'requestNode',
        name: name,
        itemUid,
        position: {
          x: clientOffsetX - leftOffset - 100,
          y: clientOffsetY - topOffset - 100,
        },
        data: { itemUid, name, type }
      }
      dispatch(addNodeToWorkflow({
        collectionUid,
        workflowUid,
        workflowNode
      }));
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }, [workflowNodes, isPreviewMode]);

  const handleAddScriptNode = () => {
    const workflowNodeUid = uuid();
    const workflowNode = {
      id: workflowNodeUid,
      type: 'scriptNode',
      name: 'New Script',
      position: {
        x: 10,
        y: 10 + (workflowNodes.length * 50),
      },
      measured: {
        width: 100,
        height: 150,
      },
      data: {
        uid: workflowNodeUid,
        type: 'script',
        name: 'New Script',
        content: '',
      }
    }
    dispatch(addNodeToWorkflow({
      collectionUid,
      workflowUid,
      workflowNode
    }));
  };

  const onConnect = useCallback(
    (params) => {
      try {
        const updatedEdges = addEdge(params, workflowNodeEdges);
        dispatch(updateworkflowNodeEdges({
          collectionUid,
          workflowUid,
          workflowNodeEdges: updatedEdges,
        }));
      } catch (error) {
        console.error('onConnect error', error);
      }
    },
    [workflowNodeEdges, updateworkflowNodeEdges]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      try {
        const updatedEdges = applyEdgeChanges(changes, workflowNodeEdges);
        dispatch(updateworkflowNodeEdges({
          collectionUid,
          workflowUid,
          workflowNodeEdges: updatedEdges,
        }));
      } catch (error) {
        console.error('onEdgesChange error', error);
      }
    },
    [workflowNodeEdges, updateworkflowNodeEdges],
  );

  const onNodesChange = useCallback(
    (changes) => {
      try {
        const updatedNodes = applyNodeChanges(changes, workflowNodes);
        dispatch(updateWorkflowNodes({
          collectionUid,
          workflowUid,
          workflowNodes: updatedNodes,
        }));
      } catch (error) {
        console.error('onNodesChange error', error);
      }
    },
    [workflowNodes, updateWorkflowNodes],
  );

  const handleToggleTabLock = () => {
    dispatch(toggleTabLock({ uid: activeTabUid }));
  };

  const handleScriptNodeChange = ({ workflowNodeUid, content }) => {
    dispatch(updateWorkflowNodeContent({
      collectionUid,
      workflowUid,
      workflowNodeUid,
      content
    }));
  };

  const handleRunWorkflow = async () => {
    await dispatch(runWorkflow({ workflowUid, collectionUid }));
  }

  drop(reactFlowWrapper);

  return (
    <StyledWrapper className='border border-red-500/30 mt-4'>
      <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          ref={reactFlowRef}
          nodes={workflowNodes}
          edges={workflowNodeEdges}
          onNodesChange={isPreviewMode ? undefined : onNodesChange}
          onEdgesChange={isPreviewMode ? undefined : onEdgesChange}
          onConnect={isPreviewMode ? undefined : onConnect}
          nodesDraggable={!isPreviewMode}
          nodesConnectable={!isPreviewMode}
          elementsSelectable={!isPreviewMode}
          snapToGrid={true}
          snapGrid={[15, 15]}
          fitView={false}
          defaultViewport={{ x: 100, y: 100, zoom: 1 }}
          nodeTypes={{
            startNode: ({ selected }) => <StartNode selected={selected} />,
            endNode: ({ selected }) => <EndNode selected={selected} />,
            scriptNode: ({ data }) => {
              const { uid, name, content } = data;
              {/* change this to a codemirror comp */}
              return <ScriptNode uid={uid} name={name} content={content} isConnectable={!isPreviewMode} onChange={handleScriptNodeChange} />
            },
            requestNode: ({ data, selected }) => {
              const { uid, itemUid, name, executionResult } = data || {};
              return <RequestNode uid={uid} itemUid={itemUid} name={name} isConnectable={!isPreviewMode} collectionUid={collectionUid} selected={selected} executionResult={executionResult} />
            },
            folderNode: ({ data }) => {
              const { uid, itemUid, name } = data || {};
              return <FolderNode uid={uid} itemUid={itemUid} name={name} isConnectable={!isPreviewMode} collectionUid={collectionUid} />
            },
          }}
        >
          <Background />
          <Panel position="top-left">
            <div className={`flex flex-row items-center gap-2`}>
              <div  className={`${isPreviewMode ? 'text-gray-500' : 'text-blue-500'}`}>{workflow?.name}</div>
              <div className='flex flex-row items-center gap-2 rounded-md px-2 py-1 hover:bg-blue-500/10 cursor-pointer' onClick={() => setIsPreviewMode(_ => !_)}>
                <PencilBoltIcon size={17} strokeWidth={2} className='text-blue-400/50' />
              </div>
              <div className='flex flex-row items-center gap-2 cursor-pointer border border-blue-500/30 rounded-md px-2 py-1 hover:bg-blue-500/10' onClick={handleRunWorkflow}>
                <IconPlus size={17} strokeWidth={1.5} className='text-blue-500' />
                <div>Run</div>
              </div>
            </div>
          </Panel>
          <Panel position="top-right">
            <div onClick={handleToggleTabLock} className={`cursor-pointer ${activeTab?.locked ? 'text-blue-500' : 'text-gray-500'}`}>
              keep tab open
            </div>
          </Panel>
          <Panel position="bottom-left">
            <div className='flex flex-row items-center gap-2'>
              <div className='flex flex-row items-center gap-2 cursor-pointer border border-blue-500/30 rounded-md px-2 py-1 hover:bg-blue-500/10' onClick={handleAddScriptNode}>
                <IconPlus size={17} strokeWidth={1.5} className='text-blue-500' />
                <div>Script</div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </StyledWrapper>
  );
};

export default WorkflowEditor;