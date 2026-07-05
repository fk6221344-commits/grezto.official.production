import React, { useState } from "react";
import { Dialog } from "@capacitor/dialog";
import { supabase } from "../../../services/supabase";
import toast from "react-hot-toast";

export function useAdminRiders(adminSelectedCityFilter: string) {
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [editingRider, setEditingRider] = useState<any | null>(null);
  const [newRider, setNewRider] = useState({
    name: "",
    phone: "",
    vehicle: "Electric Scooter",
    status: "Online",
    codBalance: 0,
    role: "Rider",
    city: ""
  });

  const handleSaveRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast.error("Database connection failed.");
      return;
    }

    try {
      const riderData = {
        ...newRider,
        city: newRider.city || (adminSelectedCityFilter !== "All" ? adminSelectedCityFilter : ""),
        updatedAt: new Date().toISOString(),
      };
      if (editingRider) {
        await supabase.from('team').update({
           name: riderData.name,
           phone: riderData.phone,
           role: riderData.role,
           city: riderData.city
        }).eq('id', editingRider.id);
        toast.success("Rider details updated! 🛵");
      } else {
        await supabase.from('team').insert({
          ...riderData,
          createdAt: new Date().toISOString(),
          completedOrders: 0,
          rating: "5.0",
        });
        toast.success("New Rider added! 🚀");
      }
      setShowRiderModal(false);
      setEditingRider(null);
    } catch (e: any) {
      toast.error("Failed to save rider info.");
    }
  };

  const handleDeleteRider = async (id: string) => {
    const { value } = await Dialog.confirm({ title: 'Confirmation', message: 'Remove this rider?' });
    if (!value || !supabase) return;
    try {
      await supabase.from("team").delete().eq('id', id);
      toast.success("Rider removed.");
    } catch (e: any) {
      toast.error("Failed to delete rider.");
    }
  };

  return {
    showRiderModal,
    setShowRiderModal,
    editingRider,
    setEditingRider,
    newRider,
    setNewRider,
    handleSaveRider,
    handleDeleteRider
  };
}
