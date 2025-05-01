import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import CollectionItemIcon from 'components/Sidebar/Collections/Collection/CollectionItem/CollectionItemIcon/index';
import { findItemInCollection } from 'utils/collections/index';

const RequestNodeStyled = styled.div`
  padding: 3px 7px;
  border-radius: 5px;
  background: transparent;
  color: ${props => props.theme.colors.text};
`;

const RequestNode = ({ uid, collectionUid, itemUid, isConnectable }) => {
  const collection = useSelector((state) => state.collections.collections.find((collection) => collection.uid === collectionUid));
  const item = findItemInCollection(collection, itemUid);
  const name = item?.name;

  return (
    <RequestNodeStyled className="flex flex-row items-center gap-1 border border-gray-200/50 rounded-md">
      <CollectionItemIcon item={item} />
      <div>{name}</div>
    </RequestNodeStyled>
  );
}

export default memo(RequestNode);