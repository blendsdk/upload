import { makeStyles, tokens } from '@fluentui/react-components';

/** Griffel styles for the upload component. */
export const useFileUploadStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    width: '100%',
    minWidth: 0,
  },
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'background-color 120ms ease, border-color 120ms ease',
    ':focus-visible': {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: '2px',
    },
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
      border: `1px dashed ${tokens.colorNeutralStroke1}`,
    },
  },
  dropzoneActive: {
    border: `1px dashed ${tokens.colorBrandForeground1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  dropzoneDisabled: {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  dropzoneIcon: {
    color: tokens.colorBrandForeground1,
  },
  dropzoneTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  dropzoneHint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  hiddenInput: {
    display: 'none',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    '@media (max-width: 600px)': {
      alignItems: 'stretch',
    },
  },
  toolbarSpacer: {
    flex: 1,
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    ':last-child': { borderBottom: 'none' },
    '@media (max-width: 600px)': {
      gap: tokens.spacingHorizontalS,
    },
  },
  itemMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
  },
  itemName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  itemMeta: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  itemStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
  },
  progress: {
    width: '100%',
    marginTop: '2px',
  },
  error: {
    width: '100%',
  },
  empty: {
    padding: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
    fontSize: tokens.fontSizeBase200,
  },
  preview: {
    width: '40px',
    height: '40px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
    flexShrink: 0,
  },
  icon: {
    width: '40px',
    height: '40px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    flexShrink: 0,
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
});
