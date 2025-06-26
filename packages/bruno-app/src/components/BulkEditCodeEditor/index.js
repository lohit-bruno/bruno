import React, { useState, useEffect } from 'react';
import CodeEditor from 'components/CodeEditor';
import { useTheme } from 'providers/Theme';
import { useSelector } from 'react-redux';
import { parseBulkKeyValue, serializeBulkKeyValue } from 'utils/common/bulkKeyValueUtils';

const BulkEditCodeEditor = ({ params, onChange, onToggle }) => {
  const preferences = useSelector((state) => state.app.preferences);
  const [bulkText, setBulkText] = useState(serializeBulkKeyValue(params));
  const { displayedTheme } = useTheme();

  useEffect(() => {
   setBulkText(serializeBulkKeyValue(params));
 }, [params]);

  const handleEdit = (value) => {
    setBulkText(value);
    const parsed = parseBulkKeyValue(value);
    onChange(parsed);
  };

  return (
    <>
      <div className="h-[200px]">
        <CodeEditor
          mode="text/plain"
          theme={displayedTheme}
          font={preferences.codeFont || 'default'}
          value={bulkText}
          onEdit={handleEdit}
        />
      </div>
      <div className="flex btn-action justify-between items-center mt-3">
        <button className="text-link select-none ml-auto" onClick={onToggle}>
          Key/Value Edit
        </button>
      </div>
    </>
  );
};

export default BulkEditCodeEditor;
