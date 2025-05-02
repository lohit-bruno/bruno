import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import styled from 'styled-components';

const StartNodeStyled = styled.div`
  width: 70px;
  padding: 7px 25px 7px 20px;
  border-radius: 5px;
  color: ${props => props.theme.colors.text};
`;

const StartNode = ({ isConnectable, selected }) => {
  return (
    <StartNodeStyled className={`flex flex-row items-center justify-center gap-1 border border-green-500/100 text-green-500 bg-green-500/10 rounded-md relative w-full h-full ${selected ? 'border-green-500/50' : ''}`}>
      Start
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className='w-2 h-2 z-1000'
        onConnect={(params) => console.log('handle onConnect source', params)}
        isConnectable={isConnectable}
      />
    </StartNodeStyled>
  );
}

export default memo(StartNode);