import { useState } from 'react';
import '@xyflow/react/dist/style.css';
import styled from 'styled-components';
import { useSelector } from 'react-redux';
import WorkflowEditor from './Editor';
import { IconSitemap, IconPlus } from '@tabler/icons';
import PencilBoltIcon from 'components/Icons/PencilBolt/index';

const StyledWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors.background};
`;

const Workflows = ({ collectionUid }) => {
  const workflows = useSelector((state) => state.workflows.workflows?.filter((workflow) => workflow.collectionUid === collectionUid));
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const handleBack = () => {
    setSelectedWorkflow(null);
  }

  const handleSetPreviewWorkflow = (workflowUid) => {
    setPreviewMode(true);
    setSelectedWorkflow(workflowUid);
  }

  const handleSetSelectedWorkflow = (workflowUid) => {
    setPreviewMode(false);
    setSelectedWorkflow(workflowUid);
  }

  return (
    <StyledWrapper className='px-4 pb-4 mt-6 w-full h-full'>
      <div className='flex items-center gap-10'>
        <div>Workflows</div>
        <div className='flex flex-row items-center gap-2'>
          <div className='flex flex-row items-center gap-2 border border-blue-500/30 rounded-md px-2 py-1 hover:bg-blue-500/10 cursor-pointer'>
            <IconPlus size={17} strokeWidth={1.5} className='text-blue-500' />
            <div className='mr-1'>New Workflow</div>
          </div>
          {selectedWorkflow && (
            <div onClick={handleBack} className='flex flex-row items-center gap-2 cursor-pointer border border-blue-500/30 rounded-md px-2 py-1'>
              <div className='mr-1'>Back</div>
            </div>
          )}
        </div>
      </div>
      <div className='grid grid-cols-6 gap-6 mt-6 w-full h-full'>
        <div className='flex flex-col gap-6 mt-6 col-span-1'>
          {workflows.map(({ uid, name, items }) => (
            <div key={uid}  className='flex flex-row items-center gap-6 cursor-pointer'>
              <div className='flex flex-row items-center gap-2' onClick={() => handleSetPreviewWorkflow(uid)}>
                <IconSitemap size={17} strokeWidth={1.5} className={items?.length ? 'text-blue-500' : 'text-gray-500'} />
                <div>{name}</div>
              </div>
              <div className='flex flex-row items-center gap-2 border border-blue-500/30 rounded-md px-2 py-1 hover:bg-blue-500/10 cursor-pointer' onClick={() => handleSetSelectedWorkflow(uid)}>
                <PencilBoltIcon size={15} strokeWidth={1.5} className='text-blue-400/50' />
                <div className='mr-1'>Edit</div>
              </div>
            </div>
          ))}
        </div>
        {selectedWorkflow && (
          <div className='col-span-5'>
            <WorkflowEditor collectionUid={collectionUid} workflowUid={selectedWorkflow} isPreviewMode={previewMode} />
          </div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default Workflows;