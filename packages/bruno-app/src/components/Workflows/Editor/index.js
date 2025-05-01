import { useRef, useCallback, useEffect, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { IconPlus } from '@tabler/icons';

import { toggleTabLock } from 'providers/ReduxStore/slices/tabs';
import { addItemToWorkflow, updateWorkflowItem } from 'providers/ReduxStore/slices/workflows';

import ScriptNode from '../CustomNodes/Script';
import RequestNode from '../CustomNodes/Request';

const StyledWrapper = styled.div`
  width: 100%;
  height: 100%;
  background: ${props => props.theme.colors.background};
  font-size: 13px;
`;

const WorkflowEditor = ({ collectionUid, workflowUid, isPreviewMode = false }) => {
  const dispatch = useDispatch();
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const activeTab = useSelector((state) => state.tabs.tabs.find((tab) => tab.uid === activeTabUid));
  const workflow = useSelector((state) => state.workflows.workflows.find((workflow) => workflow.uid === workflowUid));
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowWrapper = useRef(null);

  console.log(nodes);

  const workflowItems = useMemo(() => {
    return workflow?.items || [];
  }, [workflow]);

  useEffect(() => {
    // Create a map of existing nodes with their positions
    const existingNodesMap = nodes.reduce((acc, node) => {
      acc[node.id] = node.position;
      return acc;
    }, {});

    setNodes(workflowItems.map((item, index) => ({
      id: item.uid,
      type: item.type === 'script' ? 'scriptNode' : 'requestNode',
      // Use existing position if available, otherwise use default position
      position: existingNodesMap[item.uid] || {
        x: 10,
        y: 10 + (index * 50),
      },
      data: { label: item.name, ...item },
    })));
  }, [workflowItems, setNodes]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const [{ isOver }, drop] = useDrop({
    accept: `collection-item-${collectionUid}`,
    drop: (draggedItem) => {
      if (isPreviewMode) return;
      dispatch(addItemToWorkflow({
        collectionUid,
        workflowUid,
        itemUid: draggedItem.uid,
        type: draggedItem.type,
        name: draggedItem.name,
      }));
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const handleToggleTabLock = () => {
    dispatch(toggleTabLock({ uid: activeTabUid }));
  };

  const handleAddScriptNode = () => {
    dispatch(addItemToWorkflow({
      collectionUid,
      workflowUid,
      type: 'script',
      name: 'New Script',
    }));
  };

  const handleScriptNodeChange = ({ uid, data }) => {
    dispatch(updateWorkflowItem({
      collectionUid,
      workflowUid,
      workflowItemUid: uid,
      data,
    }));
  };

  drop(reactFlowWrapper);

  return (
    <StyledWrapper className='border border-red-500/30 mt-4'>
      <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
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
            scriptNode: ({ data }) => {
              console.log('scriptNode', data);
              return <ScriptNode uid={data.uid} data={data.data} isConnectable={!isPreviewMode} onChange={handleScriptNodeChange} />
            },
            requestNode: ({ data }) => (
              <RequestNode uid={data.uid} collectionUid={collectionUid} itemUid={data.itemUid} />
            ),
          }}
        >
          <Background />
          {/* <Controls />
          <MiniMap /> */}
          <Panel position="top-left">
            <div className={isPreviewMode ? 'text-gray-500' : 'text-blue-500'}>
              {workflow?.name}
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