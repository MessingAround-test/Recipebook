import { FiActivity, FiDollarSign, FiRefreshCw } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { NUTRIENT_LABELS } from '../../lib/dailyIntake';

export default function InsightsPanel() {
    const { analysis, analyzing, numDays, carbSuggestions } = usePlanner();

    return (
        <div className="space-y-6">
            {/* Carb Guidance */}
            <div className="glass-card bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20 p-4">
                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-purple-400">
                    🥗 Carb Diversity
                </h3>
                {carbSuggestions.length > 0 ? (
                    <>
                        <p className="text-xs text-muted-foreground mb-3">You're missing some diverse carbs. Try adding:</p>
                        <div className="space-y-2">
                            {carbSuggestions.map((sug, idx) => (
                                <div key={idx} className="bg-background/50 p-2 rounded-lg border border-white/5 text-xs">
                                    <span className="font-bold text-purple-300 capitalize">{sug.carb}: </span>
                                    <span className="text-muted-foreground">{sug.recipe.name}</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-xs text-emerald-400 font-bold">Great job! Your selected meals contain a diverse range of carbohydrate sources.</p>
                )}
            </div>

            {/* Analysis Insights */}
            <div className="glass-card bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 relative z-40 p-4">
                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-emerald-400">
                    <FiActivity /> Plan Insights
                    {analyzing && <FiRefreshCw className="animate-spin text-emerald-400/60" size={14} />}
                </h3>

                {!analysis ? (
                    <p className="text-xs text-muted-foreground italic">No meals planned yet — analysis will appear automatically once you add recipes.</p>
                ) : (
                    <>
                        <div className="mb-4">
                            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Average Daily Cost (Per Person)</div>
                            <div className="text-2xl font-black flex items-center gap-1 text-white">
                                <FiDollarSign className="text-emerald-500" />
                                {analysis.averageDailyCostPerPerson?.toFixed(2) || analysis.averageDailyCost.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 font-medium">
                                Total Cost ({numDays} days): ${analysis.totalCost.toFixed(2)}
                            </div>
                            {analysis.everydayCost > 0 && (
                                <div className="text-[10px] text-muted-foreground mt-1 font-medium">
                                    Pantry Pool: ${(analysis.everydayCost).toFixed(2)} ({(analysis.everydayCost / analysis.totalCost * 100).toFixed(1)}%)
                                </div>
                            )}
                        </div>

                        {analysis.deficiencies && analysis.deficiencies.length > 0 ? (
                            <>
                                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Deficient Nutrients</div>
                                <div className="space-y-2">
                                    {analysis.deficiencies.slice(0, 5).map((def, idx) => {
                                        const label = NUTRIENT_LABELS[def.key]?.label || def.key;
                                        return (
                                            <div key={idx} className="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5 text-xs">
                                                <span className="font-bold text-amber-400">{label}</span>
                                                <span className="text-muted-foreground font-medium">{Math.round(def.pct * 100)}% of target</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <p className="text-xs text-emerald-400 font-bold">Great job! You are hitting all your nutritional targets.</p>
                        )}
                        {analysis.numMissingSlots > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-3 italic">
                                *Includes {analysis.numMissingSlots} unassigned meals calculated at average values.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
