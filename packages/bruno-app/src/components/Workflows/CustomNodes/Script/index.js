import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
 
const ScriptNode = ({ uid, data = "", isConnectable, onChange }) => {
  const [value, setValue] = useState(data);
  const handleOnChange = (e) => {
    e.preventDefault();
    setValue(e.target.value);
  };

  const handleOnBlur = () => {
    onChange({
      uid,
      data: value,
    });
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        onConnect={(params) => console.log('handle onConnect', params)}
        isConnectable={isConnectable}
      />
      <textarea
        className="bg-transparent border-none outline-none h-[100px]"
        type="text"
        // onBlur={handleOnBlur}
        // onKeyDown={(e) => {
        //   if (e.key === 'Enter' && !e.shiftKey) {
        //     e.preventDefault();
        //     handleOnBlur();
        //   }
        // }}
        onChange={handleOnChange} 
        value={value}
        // defaultValue={data}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="a"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        isConnectable={isConnectable}
      />
    </>
  );
}

export default memo(ScriptNode);