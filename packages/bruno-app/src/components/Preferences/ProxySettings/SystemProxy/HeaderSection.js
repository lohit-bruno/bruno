import { IconNetwork } from '@tabler/icons';

const HeaderSection = () => {
  return (
    <div className="flex items-start justify-start flex-col gap-2 mt-6">
      <div className="flex flex-row items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
          <IconNetwork size={16} strokeWidth={1.5} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xs text-gray-900 dark:text-gray-100">
            System Proxy
          </h2>
          <small className="text-gray-500 dark:text-gray-400">
            Below values are sourced from your system proxy settings.
          </small>
        </div>
      </div>
    </div>
  );
};

export default HeaderSection;
