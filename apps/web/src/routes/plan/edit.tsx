import { createFileRoute } from '@tanstack/react-router';

import { PlanEditorScreen } from '../../features/plan/PlanEditorScreen';

export const Route = createFileRoute('/plan/edit')({ component: PlanEditorScreen });
