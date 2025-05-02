import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { IconFolder } from '@tabler/icons';
import { findItemInCollection } from 'utils/collections/index';

const FolderNodeStyled = styled.div`
  padding: 7px 20px;
  border-radius: 5px;
  color: ${props => props.theme.colors.text};
`;

const FolderNode = ({ collectionUid, itemUid, isConnectable, selected }) => {
  const collection = useSelector((state) => state.collections.collections.find((collection) => collection.uid === collectionUid));
  const item = findItemInCollection(collection, itemUid);
  const name = item?.name;

  return (
    <FolderNodeStyled className={`flex flex-row items-center gap-2 border border-gray-200/50 rounded-md relative w-full h-full ${selected ? 'bg-blue-500/10' : 'bg-transparent'}`}>
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className='w-2 h-2 z-1000'
        onConnect={(params) => console.log('handle onConnect target', params)}
        isConnectable={isConnectable}
      />
      <>
        <IconFolder size={17} strokeWidth={1.5} className='text-yellow-500' />
        <div>{name}</div>
      </>
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className='w-2 h-2 z-1000'
        onConnect={(params) => console.log('handle onConnect source', params)}
        isConnectable={isConnectable}
      />
    </FolderNodeStyled>
  );
}

export default memo(FolderNode);