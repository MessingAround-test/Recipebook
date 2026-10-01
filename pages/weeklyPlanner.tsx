import { Layout } from '../components/Layout';
import { PlannerContext, usePlanner } from '../components/planner/PlannerContext';
import { usePlan } from '../components/planner/usePlan';
import PlanHeader from '../components/planner/PlanHeader';
import DayFlow from '../components/planner/DayFlow';
import WeekTimeline from '../components/planner/WeekTimeline';
import SidePanel from '../components/planner/SidePanel';
import DietaryPanel from '../components/planner/DietaryPanel';
import PlannerTabs from '../components/planner/PlannerTabs';
import BrowseRecipesModal from '../components/planner/BrowseRecipesModal';
import DaySuggestModal from '../components/planner/DaySuggestModal';
import ExportModal from '../components/planner/ExportModal';
import DayQuizModal from '../components/planner/DayQuizModal';
import PlaceIntoMealModal from '../components/planner/PlaceIntoMealModal';

function PlannerContent() {
    const api = usePlan();

    if (!api.isAuthed) return null;

    const { loading } = api;

    return (
        <PlannerContext.Provider value={api}>
            <Layout title="Weekly Planner" description="Plan your meals for the week">
                <div className="pb-28 xl:pb-8 relative">
                    {loading ? (
                        <>
                            <PlanHeader />
                            <div className="flex justify-center p-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                            </div>
                        </>
                    ) : (
                        <>
                            <PlanHeader />
                            <MainArea />
                        </>
                    )}
                </div>

                <PlannerTabs />

                <BrowseRecipesModal />
                <DaySuggestModal />
                <ExportModal />
                <DayQuizModal />
                <PlaceIntoMealModal />
            </Layout>
        </PlannerContext.Provider>
    );
}

/**
 * Content grid: main area (day flow / week grid) + desktop right rail with
 * Library · Pantry · Diet always on the page. Mobile swaps main area to one
 * of the bottom-tab pages instead.
 */
function MainArea() {
    const { plannerTab } = usePlanner();

    if (plannerTab === 'plan' || plannerTab === 'week') {
        return (
            <>
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                    <div className="min-w-0">
                        {plannerTab === 'plan' ? (
                            <DayFlow />
                        ) : (
                            <div className="hidden xl:block"><WeekTimeline /></div>
                        )}
                    </div>
                    <div className="hidden xl:block">
                        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar pr-1">
                            <SidePanel />
                        </div>
                    </div>
                </div>

                {/* Week view: the plan-wide diet panel belongs below the grid */}
                {plannerTab === 'week' && (
                    <div className="hidden xl:block mt-6">
                        <DietaryPanel />
                    </div>
                )}
            </>
        );
    }

    // library / pantry / diet — mobile-only tab pages (desktop has the rail)
    return <div className="xl:hidden"><SidePanel tab={plannerTab} embedded /></div>;
}

export default function WeeklyPlanner() {
    return <PlannerContent />;
}
