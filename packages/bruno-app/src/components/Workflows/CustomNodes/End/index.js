import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import styled from 'styled-components';

const EndNodeStyled = styled.div`
  width: 70px;
  padding: 7px 20px 7px 25px;
  border-radius: 5px;
  color: ${props => props.theme.colors.text};
`;

const EndNode = ({ isConnectable, selected }) => {
  return (
    <EndNodeStyled className={`flex flex-row items-center justify-center gap-1 border border-red-500/100 text-red-500 bg-red-500/10 rounded-md relative w-full h-full ${selected ? 'border-red-500/50' : ''}`}>
      End
      <Handle
        type="target"
        id="right"
        position={Position.Left}
        className='w-2 h-2 z-1000'
        onConnect={(params) => console.log('handle onConnect source', params)}
        isConnectable={isConnectable}
      />
    </EndNodeStyled>
  );
}

export default memo(EndNode);