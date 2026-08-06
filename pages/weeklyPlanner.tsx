import { Layout } from '../components/Layout';import { PlannerContext } from '../components/planner/PlannerContext';
import { usePlan } from '../components/planner/usePlan';
import PlanHeader from '../components/planner/PlanHeader';
import DayGrid from '../components/planner/DayGrid';
import SidePanel from '../components/planner/SidePanel';
import BrowseRecipesModal from '../components/planner/BrowseRecipesModal';
import DietaryPanel from '../components/planner/DietaryPanel';
import { FiX, FiMenu } from 'react-icons/fi';

function PlannerContent() {
    const api = usePlan();

    if (!api.isAuthed) return null;

    const { loading, mobilePoolOpen, setMobilePoolOpen } = api;

    return (
        <PlannerContext.Provider value={api}>
            <Layout title="Weekly Planner" description="Plan your meals for the week">
                <div className="pb-20 relative">
                    <PlanHeader />

                    {loading ? (
                        <div className="flex justify-center p-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                            {/* Day area */}
                            <div className="min-w-0">
                                <div className="mb-6">
                                    <DietaryPanel />
                                </div>
                                <DayGrid />
                            </div>

                            {/* Side panel (desktop) */}
                            <div className="hidden xl:block">
                                <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar pr-1">
                                    <SidePanel />
                                </div>
                            </div>

                            {/* Mobile Pool toggle */}
                            <div className="xl:hidden fixed bottom-4 right-4 z-40">
                                <button
                                    onClick={() => setMobilePoolOpen(true)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/30"
                                >
                                    <FiMenu /> Pool
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile Pool Drawer */}
                {mobilePoolOpen && (
                    <div className="fixed inset-0 z-[90] flex justify-end bg-black/60 backdrop-blur-sm xl:hidden">
                        <div className="w-full max-w-md h-full bg-[#121214] border-l border-white/10 flex flex-col">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-lg font-black tracking-widest uppercase">Pool & Settings</h2>
                                <button onClick={() => setMobilePoolOpen(false)} className="p-2 text-muted-foreground hover:text-white transition-colors">
                                    <FiX size={20} />
                                </button>
                            </div>
                            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                                <SidePanel />
                            </div>
                        </div>
                    </div>
                )}

                <BrowseRecipesModal />
            </Layout>
        </PlannerContext.Provider>
    );
}

export default function WeeklyPlanner() {
    return <PlannerContent />;
}
