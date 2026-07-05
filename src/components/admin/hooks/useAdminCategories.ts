import { useState, useEffect } from "react";
import { supabase } from "../../../services/supabase";
import toast from "react-hot-toast";

export function useAdminCategories(isAuthenticated: boolean, firebaseAuthReady: boolean) {
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [newCat, setNewCat] = useState({
    name: "",
    imageUrl: "",
    bgColor: "bg-emerald-50",
  });

  useEffect(() => {
    if (!isAuthenticated || !firebaseAuthReady || !supabase) return;
    
    let sub: any;
    const fetchCats = async () => {
      try {
        const { data } = await supabase.from('categories').select('*');
        if (data) setDbCategories(data);
        
        sub = supabase.channel(`admin_categories_${Math.random()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async () => {
             const { data: updated } = await supabase.from('categories').select('*');
             if (updated) setDbCategories(updated);
          }).subscribe();
      } catch (err) {
        console.warn("Supabase categories error:", err);
      }
    };
    fetchCats();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [isAuthenticated, firebaseAuthReady]);

  const handleSaveCategory = async () => {
    if (!newCat.name || !newCat.imageUrl) {
      toast.error("Name & Image URL are required!");
      return;
    }
    const targetId = editingCategory ? editingCategory.id : newCat.name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    const catData = {
      id: targetId,
      name: newCat.name.toLowerCase().replace(/\s+/g, "_"),
      displayName: newCat.name,
      imageUrl: newCat.imageUrl,
      bgColor: newCat.bgColor,
    };

    toast.success(editingCategory ? "Category updated!" : "New category added! 🎉");
    setShowCategoryModal(false);
    setEditingCategory(null);
    setNewCat({ name: "", imageUrl: "", bgColor: "bg-emerald-50" });

    try {
      if (supabase) {
         await supabase.from('categories').upsert({
             id: targetId,
             name: newCat.name,
             image: newCat.imageUrl,
             isActive: true
         });
      }
    } catch (e) {
      console.warn("Category save remote err: ", e);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    toast.success("Category deleted!");
    try {
      if (supabase) {
        await supabase.from('categories').delete().eq('id', id);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  return {
    dbCategories,
    showCategoryModal,
    setShowCategoryModal,
    editingCategory,
    setEditingCategory,
    newCat,
    setNewCat,
    handleSaveCategory,
    handleDeleteCategory
  };
}
