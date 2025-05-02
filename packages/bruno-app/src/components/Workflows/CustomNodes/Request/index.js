import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import CollectionItemIcon from 'components/Sidebar/Collections/Collection/CollectionItem/CollectionItemIcon/index';
import { findItemInCollection } from 'utils/collections/index';
import { IconRefresh, IconCircleCheck, IconCircleX } from '@tabler/icons';

const RequestNodeStyled = styled.div`
  padding: 7px 20px;
  border-radius: 5px;
  color: ${props => props.theme.colors.text};
`;

const RequestNode = ({ collectionUid, itemUid, isConnectable, selected, executionResult = {} }) => {
  const collection = useSelector((state) => state.collections.collections.find((collection) => collection.uid === collectionUid));
  const item = findItemInCollection(collection, itemUid);
  const name = item?.name;
  const { results = [], info = {} } = executionResult;
  const currentItemExecutionResult = results?.findLast(r => r?.itemUid == itemUid);
  const { status } = currentItemExecutionResult || {};

  const getIcon = (status) => {
    switch(status) {
      case 'started': return <IconRefresh size={17} strokeWidth={1.5} className='ml-1 text-gray-500 animate-spin' />; break;
      case 'queued': return <IconRefresh size={17} strokeWidth={1.5} className='ml-1 text-gray-500 animate-spin' />; break;
      case 'sending': return <IconRefresh size={17} strokeWidth={1.5} className='ml-1 text-gray-500 animate-spin' />; break;
      case 'ended': return <IconCircleCheck size={17} strokeWidth={1.5} className='ml-1 text-green-500' />; break;
      case 'error': return <IconCircleX size={17} strokeWidth={1.5} className='ml-1 text-red-500' />; break;
      default: return <></>;
    }
  }

  return (
    <RequestNodeStyled className={`flex flex-row items-center gap-1 border border-gray-200/50 rounded-md relative w-full h-full ${selected ? 'bg-blue-500/10' : 'bg-transparent'}`}>
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className='w-2 h-2 z-1000'
        onConnect={(params) => console.log('handle onConnect target', params)}
        isConnectable={isConnectable}
      />
      <>
        <CollectionItemIcon item={item} />
        <div>{name}</div>
        {getIcon(status)}
      </>
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className='w-2 h-2 z-1000'
        onConnect={(params) => console.log('handle onConnect source', params)}
        isConnectable={isConnectable}
      />
    </RequestNodeStyled>
  );
}

export default memo(RequestNode);