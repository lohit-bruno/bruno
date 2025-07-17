import { Checkbox, Inner, Label, Switch, SwitchButton } from './StyledWrapper';

const ToggleSwitch = ({ id = '', isOn, handleToggle, size = 'm', ...props }) => {
  id = `toggle-switch-${id}`
  return (
    <Switch size={size} {...props}>
      <Checkbox checked={isOn} onChange={handleToggle} id={id} type="checkbox" size={size} />
      <Label htmlFor={id}>
        <Inner size={size} />
        <SwitchButton size={size} />
      </Label>
    </Switch>
  );
};

export default ToggleSwitch;
