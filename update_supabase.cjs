const fs = require('fs');
let content = fs.readFileSync('src/supabase.js', 'utf8');

const farmRegex = /\/\/ --- User Farms Management ---[\s\S]*?(?=\/\/ --- Transactions ---)/;
const plotsCode = `// --- Rubber Plots Management ---

  getRubberPlots: async (userId) => {
    if (isMock) {
      await delay(200);
      const plots = safeJsonParse('farmpro_rubber_plots', []);
      return plots.filter(p => p.owner_id === userId || p.tapper_id === userId);
    }
    try {
      const { data, error } = await supabase
        .from('rubber_plots')
        .select('*, owner:profiles!rubber_plots_owner_id_fkey(full_name), tapper:profiles!rubber_plots_tapper_id_fkey(full_name)')
        .or(\`owner_id.eq.\${userId},tapper_id.eq.\${userId}\`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching rubber plots:', err);
      return [];
    }
  },

  addRubberPlot: async (plotData) => {
    if (isMock) {
      await delay(200);
      const plots = safeJsonParse('farmpro_rubber_plots', []);
      const newPlot = {
        plot_id: uuidv4(),
        ...plotData,
        created_at: new Date().toISOString()
      };
      plots.push(newPlot);
      localStorage.setItem('farmpro_rubber_plots', JSON.stringify(plots));
      return newPlot;
    }
    try {
      const { data, error } = await supabase
        .from('rubber_plots')
        .insert([{
          plot_name: plotData.plot_name,
          owner_id: plotData.owner_id,
          tapper_id: plotData.tapper_id,
          tapper_phone: plotData.tapper_phone,
          default_share_ratio: plotData.default_share_ratio
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding rubber plot:', err);
      throw err;
    }
  },

  updateRubberPlot: async (id, plotData) => {
    if (isMock) {
      await delay(200);
      const plots = safeJsonParse('farmpro_rubber_plots', []);
      const index = plots.findIndex(p => p.plot_id === id);
      if (index !== -1) {
        plots[index] = { ...plots[index], ...plotData, updated_at: new Date().toISOString() };
        localStorage.setItem('farmpro_rubber_plots', JSON.stringify(plots));
        return plots[index];
      }
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('rubber_plots')
        .update({
          plot_name: plotData.plot_name,
          owner_id: plotData.owner_id,
          tapper_id: plotData.tapper_id,
          tapper_phone: plotData.tapper_phone,
          default_share_ratio: plotData.default_share_ratio,
          updated_at: new Date().toISOString()
        })
        .eq('plot_id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error updating rubber plot:', err);
      throw err;
    }
  },

  deleteRubberPlot: async (id) => {
    if (isMock) {
      await delay(200);
      let plots = safeJsonParse('farmpro_rubber_plots', []);
      plots = plots.filter(p => p.plot_id !== id);
      localStorage.setItem('farmpro_rubber_plots', JSON.stringify(plots));
      return { success: true };
    }
    try {
      const { error } = await supabase
        .from('rubber_plots')
        .delete()
        .eq('plot_id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('Error deleting rubber plot:', err);
      throw err;
    }
  },

  // --- Plot Expenses Management ---

  getPlotExpenses: async (plotId) => {
    if (isMock) {
      await delay(200);
      const expenses = safeJsonParse('farmpro_plot_expenses', []);
      return expenses.filter(e => e.plot_id === plotId);
    }
    try {
      const { data, error } = await supabase
        .from('plot_expenses')
        .select('*, recorder:profiles!plot_expenses_recorded_by_fkey(full_name)')
        .eq('plot_id', plotId)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching plot expenses:', err);
      return [];
    }
  },

  addPlotExpense: async (expenseData) => {
    if (isMock) {
      await delay(200);
      const expenses = safeJsonParse('farmpro_plot_expenses', []);
      const newExpense = {
        expense_id: uuidv4(),
        ...expenseData,
        created_at: new Date().toISOString()
      };
      expenses.push(newExpense);
      localStorage.setItem('farmpro_plot_expenses', JSON.stringify(expenses));
      return newExpense;
    }
    try {
      const { data, error } = await supabase
        .from('plot_expenses')
        .insert([{
          plot_id: expenseData.plot_id,
          recorded_by: expenseData.recorded_by,
          expense_date: expenseData.expense_date,
          category: expenseData.category,
          amount: expenseData.amount,
          description: expenseData.description
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding plot expense:', err);
      throw err;
    }
  },
  
  deletePlotExpense: async (id) => {
    if (isMock) {
      await delay(200);
      let expenses = safeJsonParse('farmpro_plot_expenses', []);
      expenses = expenses.filter(e => e.expense_id !== id);
      localStorage.setItem('farmpro_plot_expenses', JSON.stringify(expenses));
      return { success: true };
    }
    try {
      const { error } = await supabase
        .from('plot_expenses')
        .delete()
        .eq('expense_id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('Error deleting plot expense:', err);
      throw err;
    }
  },

`;
content = content.replace(farmRegex, plotsCode);

content = content.replace(
  /price_per_kg: tx\.price_per_kg \|\| 0,/g,
  `price_per_kg: tx.price_per_kg || 0,
        plot_id: tx.plot_id || null,
        tapper_id: tx.tapper_id || null,`
);

content = content.replace(
  /if \(updates\.status !== undefined\) payload\.status = updates\.status;/g,
  `if (updates.status !== undefined) payload.status = updates.status;
      if (updates.plot_id !== undefined) payload.plot_id = updates.plot_id;
      if (updates.tapper_id !== undefined) payload.tapper_id = updates.tapper_id;`
);

fs.writeFileSync('src/supabase.js', content);
console.log('supabase.js updated successfully');
