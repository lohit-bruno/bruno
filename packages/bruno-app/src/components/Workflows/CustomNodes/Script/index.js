import React, { memo, useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import styled from 'styled-components';

const ScriptNodeStyled = styled.div`
  padding: 5px;
  border-radius: 5px;
  background: transparent;
  color: ${props => props.theme.colors.text};
`;
 
const ScriptNode = ({ uid, name, content = "", isConnectable, onChange, selected }) => {
  const [value, setValue] = useState(content);
  const handleOnChange = (e) => {
    e.preventDefault();
    setValue(e.target.value);
  };

  const handleOnBlur = () => {
    onChange({
      workflowNodeUid: uid,
      content: value,
    });
  };

  const handleOnKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleOnBlur();
    }
  };

  return (
    <ScriptNodeStyled className="flex flex-row items-center gap-1 border border-gray-200/50 rounded-md relative w-full h-full">
      {/* <NodeResizer
        color="#ff0071"
        isVisible={selected}
        minWidth={100}
        minHeight={30}
      /> */}
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className='w-2 h-2 z-1000'
        onConnect={(params) => console.log('handle onConnect target', params)}
        isConnectable={isConnectable}
      />
      <div className='flex flex-col gap-1 justify-start p-1'>
        <div className='text-xs opacity-50'>{name}</div>
        <textarea
          className="bg-transparent border-none outline-none h-[300px] w-full"
          type="text"
          onBlur={handleOnBlur}
          onKeyDown={handleOnKeyDown}
          onChange={handleOnChange}
          value={value}
        />
      </div>
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className='w-2 h-2 z-1000'
        onConnect={(params) => console.log('handle onConnect source', params)}
        isConnectable={isConnectable}
      />
    </ScriptNodeStyled>
  );
}

export default memo(ScriptNode);