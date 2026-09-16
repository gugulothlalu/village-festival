import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from "./lib/supabase";
import "./App.css";

/* =========================================================
   HELPERS
========================================================= */

const formatDate = (date) => {
  if (!date) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

const parseDate = (value) => {
  if (!value) return null;

  const [day, month, year] = value.split("/").map(Number);

  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day);
};

const parseDbDate = (value) => {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const dbDateToDisplay = (value) => {
  return value ? formatDate(parseDbDate(value)) : "";
};

const toDbDate = (date) => {
  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizePhone = (phone) => {
  return phone.replace(/\D/g, "");
};

const internalEmail = (phone) => {
  return `${normalizePhone(phone)}@festivalconnect.local`;
};

const authPassword = (pin) => {
  return `FC!${pin}#2026`;
};

const getFileExtension = (file) => {
  const extension = file?.name?.split(".").pop()?.toLowerCase();

  if (extension) return extension;

  if (file?.type === "image/png") return "png";
  if (file?.type === "image/webp") return "webp";
  if (file?.type === "image/gif") return "gif";

  return "jpg";
};

const getFestivalImageStoragePath = (imageUrl) => {
  if (!imageUrl) return null;
  try {
    const marker = "/storage/v1/object/public/festival-images/";
    const index = imageUrl.indexOf(marker);
    if (index < 0) return null;
    return decodeURIComponent(imageUrl.slice(index + marker.length).split("?")[0]);
  } catch {
    return null;
  }
};

/* =========================================================
   APP
========================================================= */

function App() {
  /* =======================================================
     AUTH
  ======================================================= */

  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);

  const [showAppUsage, setShowAppUsage] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsPeriod, setAnalyticsPeriod] = useState("daily");
  
  const [villageName, setVillageName] = useState("");
  const [editingVillageName, setEditingVillageName] = useState(false);
  const [villageNameDraft, setVillageNameDraft] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  /* =======================================================
     FESTIVALS
  ======================================================= */

  const [festivals, setFestivals] = useState([]);
  const [selectedFestival, setSelectedFestival] = useState(null);

  const [showFestivalForm, setShowFestivalForm] = useState(false);
  const [editingFestivalId, setEditingFestivalId] = useState(null);

  const [festivalName, setFestivalName] = useState("");
  const [festivalYear, setFestivalYear] = useState(
    String(new Date().getFullYear())
  );
  const [festivalDate, setFestivalDate] = useState(null);
  const [festivalDescription, setFestivalDescription] = useState("");

  const [festivalPhoto, setFestivalPhoto] = useState(null);
  const [festivalPhotoPreview, setFestivalPhotoPreview] = useState("");
  const [coverPhotoBusy, setCoverPhotoBusy] = useState(false);
  const [memoryActionId, setMemoryActionId] = useState(null);

  /* =======================================================
     COLLECTIONS
  ======================================================= */

  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState(null);

  const [collectionName, setCollectionName] = useState("");
  const [collectionPhone, setCollectionPhone] = useState("");
  const [collectionDate, setCollectionDate] = useState(null);
  const [collectionAmount, setCollectionAmount] = useState("");
  const [collectionNotes, setCollectionNotes] = useState("");

  /* =======================================================
     EXPENSES
  ======================================================= */

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const [expenseName, setExpenseName] = useState("");
  const [expenseDate, setExpenseDate] = useState(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");

  /* =======================================================
     DISTRIBUTION
  ======================================================= */

  const [showDistributionForm, setShowDistributionForm] = useState(false);
  const [editingDistributionId, setEditingDistributionId] = useState(null);

  const [distributionName, setDistributionName] = useState("");
  const [distributionDate, setDistributionDate] = useState(null);
  const [distributionItems, setDistributionItems] = useState("");
  const [distributionPhone, setDistributionPhone] = useState("");
  const [distributionAmount, setDistributionAmount] = useState("");

  /* =======================================================
     FESTIVAL COVER PHOTO UPDATE / DELETE
  ======================================================= */

  const handleReplaceCoverPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !authUser || !selectedFestival) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      alert("Festival photo should be 6 MB or smaller.");
      return;
    }

    setCoverPhotoBusy(true);
    let newPath = null;
    try {
      const extension = getFileExtension(file);
      newPath = `${authUser.id}/festivals/${selectedFestival.id}/cover-${crypto.randomUUID()}.${extension}`;
      const newUrl = await uploadImage(file, newPath);

      const { error } = await supabase
        .from("festivals")
        .update({ festival_photo_url: newUrl })
        .eq("id", selectedFestival.id)
        .eq("user_id", authUser.id);
      if (error) throw error;

      const oldPath = getFestivalImageStoragePath(selectedFestival.photo);
      if (oldPath) {
        const { error: removeError } = await supabase.storage
          .from("festival-images")
          .remove([oldPath]);
        if (removeError) console.warn("Old cover cleanup failed:", removeError.message);
      }

      await loadUserData(authUser.id);
      alert("Festival cover photo updated.");
    } catch (error) {
      if (newPath) {
        await supabase.storage.from("festival-images").remove([newPath]);
      }
      console.error("Cover photo update error:", error);
      alert(error?.message || "Unable to update festival cover photo.");
    } finally {
      setCoverPhotoBusy(false);
    }
  };

  const handleDeleteCoverPhoto = async () => {
    if (!authUser || !selectedFestival?.photo) return;
    if (!window.confirm("Delete this festival cover photo?")) return;

    setCoverPhotoBusy(true);
    try {
      const oldPath = getFestivalImageStoragePath(selectedFestival.photo);
      const { error } = await supabase
        .from("festivals")
        .update({ festival_photo_url: null })
        .eq("id", selectedFestival.id)
        .eq("user_id", authUser.id);
      if (error) throw error;

      if (oldPath) {
        const { error: removeError } = await supabase.storage
          .from("festival-images")
          .remove([oldPath]);
        if (removeError) console.warn("Cover photo storage cleanup failed:", removeError.message);
      }

      await loadUserData(authUser.id);
      alert("Festival cover photo deleted.");
    } catch (error) {
      console.error("Cover photo delete error:", error);
      alert(error?.message || "Unable to delete festival cover photo.");
    } finally {
      setCoverPhotoBusy(false);
    }
  };

  /* =======================================================
     MEMORIES
  ======================================================= */

  const [memoryPhotos, setMemoryPhotos] = useState([]);
  const [memoryUploading, setMemoryUploading] = useState(false);

  /* =======================================================
     RESET FORMS
  ======================================================= */

  const resetFestivalForm = () => {
    setEditingFestivalId(null);
    setFestivalName("");
    setFestivalYear(String(new Date().getFullYear()));
    setFestivalDate(null);
    setFestivalDescription("");
    setFestivalPhoto(null);
    setFestivalPhotoPreview("");
  };

  const resetCollectionForm = () => {
    setEditingCollectionId(null);
    setCollectionName("");
    setCollectionPhone("");
    setCollectionDate(null);
    setCollectionAmount("");
    setCollectionNotes("");
  };

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseName("");
    setExpenseDate(null);
    setExpenseAmount("");
    setExpenseNotes("");
  };

  const resetDistributionForm = () => {
    setEditingDistributionId(null);
    setDistributionName("");
    setDistributionDate(null);
    setDistributionItems("");
    setDistributionPhone("");
    setDistributionAmount("");
  };

  /* =======================================================
     LOAD USER DATA
  ======================================================= */

  const loadUserData = async (userId, userForProfile = null) => {
    if (!userId) return;

    const profileUser = userForProfile || authUser;

    try {
      const [
        profileResult,
        festivalsResult,
        collectionsResult,
        expensesResult,
        distributionsResult,
        memoriesResult,
      ] = await Promise.all([
        supabase
          .from("village_profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),

        supabase
          .from("festivals")
          .select("*")
          .eq("user_id", userId)
          .order("year", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("collections")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),

        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),

        supabase
          .from("distributions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),

        supabase
          .from("memories")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
      ]);

      if (profileResult.error) {
        console.warn("Village profile load warning:", profileResult.error);
      }

      if (festivalsResult.error) {
        throw festivalsResult.error;
      }

      if (collectionsResult.error) {
        throw collectionsResult.error;
      }

      if (expensesResult.error) {
        throw expensesResult.error;
      }

      if (distributionsResult.error) {
        throw distributionsResult.error;
      }

      if (memoriesResult.error) {
        throw memoriesResult.error;
      }

      const savedVillageName =
        profileResult.data?.village_name ||
        profileUser?.user_metadata?.village_name ||
        "";

      const savedPhone =
        profileResult.data?.phone ||
        profileUser?.user_metadata?.phone ||
        "";

      if (savedVillageName) {
        setVillageName(savedVillageName);
      }

      if (savedPhone) {
        setPhoneNumber(savedPhone);
      }

      const dbFestivals = festivalsResult.data || [];
      const dbCollections = collectionsResult.data || [];
      const dbExpenses = expensesResult.data || [];
      const dbDistributions = distributionsResult.data || [];
      const dbMemories = memoriesResult.data || [];

      const mappedFestivals = dbFestivals.map((festival) => {
        const festivalCollections = dbCollections
          .filter((item) => item.festival_id === festival.id)
          .map((item) => ({
            id: item.id,
            name: item.name,
            phone: item.phone || "",
            date: dbDateToDisplay(item.collection_date),
            amount: Number(item.amount || 0),
            notes: item.notes || "",
          }));

        const festivalExpenses = dbExpenses
          .filter((item) => item.festival_id === festival.id)
          .map((item) => ({
            id: item.id,
            name: item.name,
            date: dbDateToDisplay(item.expense_date),
            amount: Number(item.amount || 0),
            notes: item.notes || "",
          }));

        const festivalDistributions = dbDistributions
          .filter((item) => item.festival_id === festival.id)
          .map((item) => ({
            id: item.id,
            name: item.name,
            date: dbDateToDisplay(item.distribution_date),
            items: item.items || "",
            phone: item.phone || "",
            amount: Number(item.amount || 0),
          }));

        const festivalMemories = dbMemories
          .filter((item) => item.festival_id === festival.id)
          .map((item) => ({
            id: item.id,
            imageUrl: item.image_url,
            caption: item.caption || "",
          }));

        return {
          id: festival.id,
          name: festival.festival_name,
          year: String(festival.year),
          date: dbDateToDisplay(festival.festival_date),
          description: festival.description || "",
          photo: festival.festival_photo_url || "",
          collections: festivalCollections,
          expenses: festivalExpenses,
          distributions: festivalDistributions,
          memories: festivalMemories,
        };
      });

      setFestivals(mappedFestivals);

      setSelectedFestival((currentSelected) => {
        if (!currentSelected) return null;

        const updated = mappedFestivals.find(
          (item) => item.id === currentSelected.id
        );

        return updated || null;
      });
    } catch (error) {
      console.error("Load data error:", error);
      alert(error?.message || "Unable to load your festival data.");
    }
  };

  /* =======================================================
     AUTH INITIALIZATION
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!mounted) return;

        const sessionUser = data?.session?.user || null;

        setAuthUser(sessionUser);
        setIsLoggedIn(Boolean(sessionUser));

        if (sessionUser) {
          await loadUserData(sessionUser.id, sessionUser);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const sessionUser = session?.user || null;

      setAuthUser(sessionUser);
      setIsLoggedIn(Boolean(sessionUser));

      if (sessionUser) {
        await loadUserData(sessionUser.id, sessionUser);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =======================================================
     CREATE ACCOUNT
  ======================================================= */

  const handleCreateAccount = async (event) => {
    event.preventDefault();

    const cleanVillageName = villageName.trim();
    const cleanPhone = normalizePhone(phoneNumber);

    if (!cleanVillageName) {
      alert("Please enter village name.");
      return;
    }

    if (!cleanPhone) {
      alert("Please enter phone number.");
      return;
    }

    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      alert("Please enter a valid phone number.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      alert("PIN must contain exactly 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      alert("PIN and Confirm PIN do not match.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const email = internalEmail(cleanPhone);
      const password = authPassword(pin);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            village_name: cleanVillageName,
            phone: cleanPhone,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error("Account could not be created.");
      }

      /*
       * Confirm email is OFF in Supabase.
       * Therefore a session should normally be created immediately.
       */

      const userId = data.user.id;

      const { error: profileError } = await supabase
        .from("village_profiles")
        .upsert(
          {
            id: userId,
            village_name: cleanVillageName,
            phone: cleanPhone,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        throw profileError;
      }

      setAuthUser(data.user);
      setIsLoggedIn(true);
      setShowCreateAccount(false);
      setPin("");
      setConfirmPin("");

      await loadUserData(userId);
    } catch (error) {
      console.error("Create account error:", error);

      let message = error?.message || "Unable to create account.";

      if (
        message.toLowerCase().includes("already registered") ||
        message.toLowerCase().includes("already exists")
      ) {
        message =
          "This phone number already has an account. Please use tdn.";
      }

      alert(message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  /* =======================================================
     LOGIN
  ======================================================= */

  const handleLogin = async (event) => {
    event.preventDefault();

    const cleanPhone = normalizePhone(phoneNumber);
    const cleanVillageName = villageName.trim();

    if (!cleanPhone) {
      alert("Please enter phone number.");
      return;
    }

    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      alert("Please enter a valid phone number.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      alert("Please enter your 4-digit PIN.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const email = internalEmail(cleanPhone);
      const password = authPassword(pin);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error("Login failed.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("village_profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      let usableProfile = profile;

      if (!usableProfile) {
        const metadataVillageName =
          data.user.user_metadata?.village_name || cleanVillageName;

        const metadataPhone =
          data.user.user_metadata?.phone || cleanPhone;

        if (!metadataVillageName) {
          await supabase.auth.signOut();

          throw new Error(
            "Village profile is missing. Please create the account again."
          );
        }

        const { data: repairedProfile, error: repairError } =
          await supabase
            .from("village_profiles")
            .upsert(
              {
                id: data.user.id,
                village_name: metadataVillageName,
                phone: metadataPhone,
              },
              { onConflict: "id" }
            )
            .select()
            .single();

        if (repairError) {
          await supabase.auth.signOut();

          throw new Error(
            "Your login is valid, but the village profile could not be restored. " +
              repairError.message
          );
        }

        usableProfile = repairedProfile;
      }

      if (
        cleanVillageName &&
        usableProfile.village_name.trim().toLowerCase() !==
          cleanVillageName.toLowerCase()
      ) {
        await supabase.auth.signOut();

        throw new Error("Village name does not match this account.");
      }
       const { error: usageError } = await supabase
  .from("usage_events")
  .insert({
    event_name: "login_success",
    village_profile_id: data.user.id,
  });

if (usageError) {
  console.error("Login analytics error:", usageError.message);
}

      setAuthUser(data.user);
      setIsLoggedIn(true);
      setVillageName(usableProfile.village_name);
      setPhoneNumber(usableProfile.phone);
      setPin("");

      await loadUserData(data.user.id, data.user);
    } catch (error) {
      console.error("Login error:", error);

      let message = error?.message || "Unable to login.";

      if (
        message.toLowerCase().includes("invalid login credentials")
      ) {
        message = "Phone number or 4-digit PIN is incorrect.";
      }

      alert(message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSaveVillageName = async () => {
    const clean = villageNameDraft.trim();
    if (!clean || !authUser?.id) return alert("Enter a village name.");
    const { error } = await supabase.from("village_profiles")
      .update({ village_name: clean }).eq("id", authUser.id);
    if (error) return alert(error.message);
    setVillageName(clean);
    setEditingVillageName(false);
    alert("Village name updated.");
  };

  const handleDeleteFestival = async (festival) => {
    if (!authUser?.id) return;
    if (!window.confirm(`Delete "${festival.name}" and its collections and expenses?`)) return;
    try {
      for (const table of ["collections", "expenses", "distributions", "memories"]) {
        const { error } = await supabase.from(table).delete()
          .eq("festival_id", festival.id).eq("user_id", authUser.id);
        if (error) throw error;
      }
      const { error } = await supabase.from("festivals").delete()
        .eq("id", festival.id).eq("user_id", authUser.id);
      if (error) throw error;
      setFestivals(prev => prev.filter(item => item.id !== festival.id));
      if (selectedFestival?.id === festival.id) setSelectedFestival(null);
      alert("Festival and its linked records deleted.");
    } catch (error) {
      alert(`Could not delete festival: ${error.message}`);
    }
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setAuthUser(null);
      setIsLoggedIn(false);

      setVillageName("");
      setPhoneNumber("");
      setPin("");
      setConfirmPin("");

      setFestivals([]);
      setSelectedFestival(null);

      setShowFestivalForm(false);
      setShowCollectionForm(false);
      setShowExpenseForm(false);
      setShowDistributionForm(false);

      resetFestivalForm();
      resetCollectionForm();
      resetExpenseForm();
      resetDistributionForm();

      setMemoryPhotos([]);
    } catch (error) {
      console.error("Logout error:", error);
      alert(error?.message || "Unable to logout.");
    }
  };

  /* =======================================================
     FESTIVAL PHOTO SELECT
  ======================================================= */

  const handleFestivalPhotoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      alert("Festival photo should be 6 MB or smaller.");
      return;
    }

    setFestivalPhoto(file);
    setFestivalPhotoPreview(URL.createObjectURL(file));
  };

  /* =======================================================
     UPLOAD IMAGE
  ======================================================= */

  const uploadImage = async (file, path) => {
    if (!file) {
      throw new Error("Image file is missing.");
    }

    const { error } = await supabase.storage
      .from("festival-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from("festival-images")
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new Error("Could not create image URL.");
    }

    return data.publicUrl;
  };

  /* =======================================================
     ADD FESTIVAL
  ======================================================= */

  const handleAddFestival = async (event) => {
    event.preventDefault();

    if (!authUser) {
      alert("Please login again.");
      return;
    }

    const cleanName = festivalName.trim();
    const cleanYear = Number(festivalYear);

    if (!cleanName) {
      alert("Please enter festival name.");
      return;
    }

    if (!cleanYear || cleanYear < 1900 || cleanYear > 2200) {
      alert("Please enter a valid festival year.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const payload = {
        festival_name: cleanName,
        year: cleanYear,
        festival_date: toDbDate(festivalDate),
        description: festivalDescription.trim(),
      };

      if (editingFestivalId) {
        const { error } = await supabase
          .from("festivals")
          .update(payload)
          .eq("id", editingFestivalId)
          .eq("user_id", authUser.id);

        if (error) throw error;
      } else {
        const { data: festival, error } = await supabase
          .from("festivals")
          .insert({
            ...payload,
            user_id: authUser.id,
            festival_photo_url: null,
          })
          .select()
          .single();

        if (error) throw error;

        if (festivalPhoto) {
          const extension = getFileExtension(festivalPhoto);
          const path =
            `${authUser.id}/festivals/${festival.id}/cover-` +
            `${crypto.randomUUID()}.${extension}`;
          const photoUrl = await uploadImage(festivalPhoto, path);

          const { error: updateError } = await supabase
            .from("festivals")
            .update({ festival_photo_url: photoUrl })
            .eq("id", festival.id)
            .eq("user_id", authUser.id);

          if (updateError) throw updateError;
        }
      }

      const wasEditing = Boolean(editingFestivalId);
      resetFestivalForm();
      setShowFestivalForm(false);
      await loadUserData(authUser.id);

      alert(wasEditing ? "Festival details updated." : "Festival added successfully.");
    } catch (error) {
      console.error("Festival save error:", error);
      alert(error?.message || "Unable to save festival.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  /* =======================================================
     COLLECTIONS
  ======================================================= */

  const handleSaveCollection = async (event) => {
    event.preventDefault();

    if (!authUser || !selectedFestival) {
      alert("Please select a festival.");
      return;
    }

    if (!collectionName.trim()) {
      alert("Please enter contributor name.");
      return;
    }

    if (!collectionAmount || Number(collectionAmount) < 0) {
      alert("Please enter a valid collection amount.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const payload = {
        festival_id: selectedFestival.id,
        user_id: authUser.id,
        name: collectionName.trim(),
        phone: collectionPhone.trim(),
        collection_date: toDbDate(collectionDate),
        amount: Number(collectionAmount),
        notes: collectionNotes.trim(),
      };

      if (editingCollectionId) {
        const { error } = await supabase
          .from("collections")
          .update(payload)
          .eq("id", editingCollectionId)
          .eq("user_id", authUser.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("collections")
          .insert(payload);

        if (error) {
          throw error;
        }
      }

      resetCollectionForm();
      setShowCollectionForm(false);

      await loadUserData(authUser.id);
    } catch (error) {
      console.error("Collection save error:", error);
      alert(error?.message || "Unable to save collection.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEditCollection = (collection) => {
    setEditingCollectionId(collection.id);
    setCollectionName(collection.name || "");
    setCollectionPhone(collection.phone || "");
    setCollectionDate(parseDate(collection.date));
    setCollectionAmount(String(collection.amount ?? ""));
    setCollectionNotes(collection.notes || "");
    setShowCollectionForm(true);
  };

  /* =======================================================
     EXPENSES
  ======================================================= */

  const handleSaveExpense = async (event) => {
    event.preventDefault();

    if (!authUser || !selectedFestival) {
      alert("Please select a festival.");
      return;
    }

    if (!expenseName.trim()) {
      alert("Please enter expense name.");
      return;
    }

    if (!expenseAmount || Number(expenseAmount) < 0) {
      alert("Please enter a valid expense amount.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const payload = {
        festival_id: selectedFestival.id,
        user_id: authUser.id,
        name: expenseName.trim(),
        expense_date: toDbDate(expenseDate),
        amount: Number(expenseAmount),
        notes: expenseNotes.trim(),
      };

      if (editingExpenseId) {
        const { error } = await supabase
          .from("expenses")
          .update(payload)
          .eq("id", editingExpenseId)
          .eq("user_id", authUser.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("expenses")
          .insert(payload);

        if (error) {
          throw error;
        }
      }

      resetExpenseForm();
      setShowExpenseForm(false);

      await loadUserData(authUser.id);
    } catch (error) {
      console.error("Expense save error:", error);
      alert(error?.message || "Unable to save expense.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseName(expense.name || "");
    setExpenseDate(parseDate(expense.date));
    setExpenseAmount(String(expense.amount ?? ""));
    setExpenseNotes(expense.notes || "");
    setShowExpenseForm(true);
  };

  /* =======================================================
     DISTRIBUTION
  ======================================================= */

  const handleSaveDistribution = async (event) => {
    event.preventDefault();

    if (!authUser || !selectedFestival) {
      alert("Please select a festival.");
      return;
    }

    if (!distributionName.trim()) {
      alert("Please enter name.");
      return;
    }

    if (!distributionAmount || Number(distributionAmount) < 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const payload = {
        festival_id: selectedFestival.id,
        user_id: authUser.id,
        name: distributionName.trim(),
        distribution_date: toDbDate(distributionDate),
        items: distributionItems.trim(),
        phone: distributionPhone.trim(),
        amount: Number(distributionAmount),
      };

      if (editingDistributionId) {
        const { error } = await supabase
          .from("distributions")
          .update(payload)
          .eq("id", editingDistributionId)
          .eq("user_id", authUser.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("distributions")
          .insert(payload);

        if (error) {
          throw error;
        }
      }

      resetDistributionForm();
      setShowDistributionForm(false);

      await loadUserData(authUser.id);
    } catch (error) {
      console.error("Distribution save error:", error);
      alert(error?.message || "Unable to save distribution.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEditDistribution = (distribution) => {
    setEditingDistributionId(distribution.id);
    setDistributionName(distribution.name || "");
    setDistributionDate(parseDate(distribution.date));
    setDistributionItems(distribution.items || "");
    setDistributionPhone(distribution.phone || "");
    setDistributionAmount(String(distribution.amount ?? ""));
    setShowDistributionForm(true);
  };

  /* =======================================================
     MEMORIES
  ======================================================= */

  const handleMemoryPhotoChange = (event) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const imageFiles = files.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length !== files.length) {
      alert("Only image files can be uploaded.");
    }

    const largeFiles = imageFiles.filter(
      (file) => file.size > 6 * 1024 * 1024
    );

    if (largeFiles.length) {
      alert("Each memory photo should be 6 MB or smaller.");
    }

    const validFiles = imageFiles.filter(
      (file) => file.size <= 6 * 1024 * 1024
    );

    setMemoryPhotos(validFiles);
  };

  const handleUploadMemories = async () => {
    if (!authUser || !selectedFestival) {
      alert("Please select a festival.");
      return;
    }

    if (!memoryPhotos.length) {
      alert("Please select photos first.");
      return;
    }

    setMemoryUploading(true);

    try {
      for (const file of memoryPhotos) {
        const extension = getFileExtension(file);

        const path =
          `${authUser.id}/festivals/${selectedFestival.id}/memories/` +
          `${crypto.randomUUID()}.${extension}`;

        const imageUrl = await uploadImage(file, path);

        const { error } = await supabase
          .from("memories")
          .insert({
            festival_id: selectedFestival.id,
            user_id: authUser.id,
            image_url: imageUrl,
            caption: "",
          });

        if (error) {
          throw error;
        }
      }

      setMemoryPhotos([]);

      await loadUserData(authUser.id);

      alert("Festival memories uploaded successfully.");
    } catch (error) {
      console.error("Memory upload error:", error);
      alert(error?.message || "Unable to upload memories.");
    } finally {
      setMemoryUploading(false);
    }
  };

  const handleReplaceMemoryPhoto = async (memory, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !authUser || !selectedFestival) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      alert("Memory photo should be 6 MB or smaller.");
      return;
    }

    setMemoryActionId(memory.id);
    let newPath = null;
    try {
      const extension = getFileExtension(file);
      newPath = `${authUser.id}/festivals/${selectedFestival.id}/memories/${crypto.randomUUID()}.${extension}`;
      const newUrl = await uploadImage(file, newPath);

      const { error } = await supabase
        .from("memories")
        .update({ image_url: newUrl })
        .eq("id", memory.id)
        .eq("festival_id", selectedFestival.id)
        .eq("user_id", authUser.id);
      if (error) throw error;

      const oldPath = getFestivalImageStoragePath(memory.imageUrl);
      if (oldPath) {
        const { error: removeError } = await supabase.storage
          .from("festival-images")
          .remove([oldPath]);
        if (removeError) console.warn("Old memory cleanup failed:", removeError.message);
      }

      await loadUserData(authUser.id);
      alert("Memory photo replaced.");
    } catch (error) {
      if (newPath) {
        await supabase.storage.from("festival-images").remove([newPath]);
      }
      console.error("Memory photo replace error:", error);
      alert(error?.message || "Unable to replace memory photo.");
    } finally {
      setMemoryActionId(null);
    }
  };

  const handleDeleteMemoryPhoto = async (memory) => {
    if (!authUser || !selectedFestival) return;
    if (!window.confirm("Delete this festival memory photo?")) return;

    setMemoryActionId(memory.id);
    try {
      const { error } = await supabase
        .from("memories")
        .delete()
        .eq("id", memory.id)
        .eq("festival_id", selectedFestival.id)
        .eq("user_id", authUser.id);
      if (error) throw error;

      const oldPath = getFestivalImageStoragePath(memory.imageUrl);
      if (oldPath) {
        const { error: removeError } = await supabase.storage
          .from("festival-images")
          .remove([oldPath]);
        if (removeError) console.warn("Deleted memory storage cleanup failed:", removeError.message);
      }

      await loadUserData(authUser.id);
      alert("Memory photo deleted.");
    } catch (error) {
      console.error("Memory photo delete error:", error);
      alert(error?.message || "Unable to delete memory photo.");
    } finally {
      setMemoryActionId(null);
    }
  };

  const loadPublicAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const { data, error } = await supabase.functions.invoke("bright-processor", {
        body: { action: "public_analytics" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Analytics load avvaledu.");
      setAnalytics(data.analytics || { daily: [], monthly: [], yearly: [] });
    } catch (error) {
      console.error("Public analytics error:", error);
      setAnalyticsError(error?.message || "Analytics load avvaledu.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const totalCollection = festivals.reduce((festivalTotal, festival) => {
    return (
      festivalTotal +
      (festival.collections || []).reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      )
    );
  }, 0);

  const totalExpenses = festivals.reduce((festivalTotal, festival) => {
    return (
      festivalTotal +
      (festival.expenses || []).reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      )
    );
  }, 0);

  const remainingBalance = totalCollection - totalExpenses;

  const selectedCollectionTotal =
    selectedFestival?.collections?.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    ) || 0;

  const selectedExpenseTotal =
    selectedFestival?.expenses?.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    ) || 0;

  const selectedBalance = selectedCollectionTotal - selectedExpenseTotal;

  /* =======================================================
     AUTH LOADING
  ======================================================= */

  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">🚩🛕</div>

          <h1>Festival Connect</h1>

          <p className="login-subtitle">
            Loading your village festival records...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     LOGIN / CREATE ACCOUNT PAGE
  ======================================================= */

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-decoration left-decoration">
          <div>Our</div>
          <div>Traditions</div>
          <div>Our Pride</div>
          <span>────</span>
        </div>

        <div className="login-decoration right-decoration">
          <div>Festivals</div>
          <div>Keep Us</div>
          <div>Together</div>
          <span>────</span>
        </div>

        <div className="login-wave wave-one"></div>
        <div className="login-wave wave-two"></div>

        <div className="login-card">
          <div className="login-logo">🚩🛕</div>

          <h1>Festival Connect</h1>

          <p className="login-subtitle">
            Manage your village festivals, collections &
            <br />
            memories
          </p>

          {showCreateAccount ? (
            <form onSubmit={handleCreateAccount}>
              <div className="login-form-group">
                <label>Village Name</label>

                <input
                  type="text"
                  placeholder="Enter village name"
                  value={villageName}
                  onChange={(event) =>
                    setVillageName(event.target.value)
                  }
                  autoComplete="organization"
                />
              </div>

              <div className="login-form-group">
                <label>Phone Number</label>

                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChange={(event) =>
                    setPhoneNumber(event.target.value)
                  }
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </div>

              <div className="login-form-group">
                <label>4-Digit PIN</label>

                <input
                  type="password"
                  placeholder="Create 4-digit PIN"
                  value={pin}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4);

                    setPin(value);
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="new-password"
                />
              </div>

              <div className="login-form-group">
                <label>Confirm PIN</label>

                <input
                  type="password"
                  placeholder="Confirm 4-digit PIN"
                  value={confirmPin}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4);

                    setConfirmPin(value);
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="login-submit"
                disabled={authSubmitting}
              >
                {authSubmitting
                  ? "Creating Account..."
                  : "Create Account"}
              </button>

              <button
                type="button"
                className="secondary-btn"
                style={{
                  width: "100%",
                  marginTop: "12px",
                }}
                onClick={() => {
                  setShowCreateAccount(false);
                  setPin("");
                  setConfirmPin("");
                }}
              >
                Already have an account? Login
              </button>
            </form>
          ) : showForgotPin ? (
            <div className="forgot-pin-panel">
              <h2>Forgot PIN?</h2>
              <p>
                For your account safety, PIN reset is handled by the village
                administrator. Please contact the admin and ask for a PIN reset.
              </p>
              <div className="forgot-pin-contact">
                <span>Admin Contact</span>
                <a href="tel:9959069636">9959069636</a>
              </div>
              <p className="forgot-pin-note">
                The admin will verify your identity before helping you reset your PIN.
                Never share your current PIN with anyone.
              </p>
              <button
                type="button"
                className="login-submit"
                onClick={() => {
                  setShowForgotPin(false);
                  setPin("");
                }}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="login-form-group">
                <label>Village Name</label>

                <input
                  type="text"
                  placeholder="Enter village name"
                  value={villageName}
                  onChange={(event) =>
                    setVillageName(event.target.value)
                  }
                  autoComplete="organization"
                />
              </div>

              <div className="login-form-group">
                <label>Phone Number</label>

                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChange={(event) =>
                    setPhoneNumber(event.target.value)
                  }
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </div>

              <div className="login-form-group">
                <label>4-Digit PIN</label>

                <input
                  type="password"
                  placeholder="Enter 4-digit PIN"
                  value={pin}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4);

                    setPin(value);
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="login-submit"
                disabled={authSubmitting}
              >
                {authSubmitting ? "Logging In..." : "Login / Continue"}
              </button>

              <button
                type="button"
                className="forgot-pin-link"
                onClick={() => {
                  setShowForgotPin(true);
                  setPin("");
                }}
              >
                Forgot PIN?
              </button>

              <button
                type="button"
                className="secondary-btn"
                style={{
                  width: "100%",
                  marginTop: "12px",
                }}
                onClick={() => {
                  setShowCreateAccount(true);
                  setPin("");
                  setConfirmPin("");
                }}
              >
                New Village? Create Account
              </button>

              <button
  type="button"
  className="secondary-btn"
  style={{ width: "100%", marginTop: "12px" }}
  onClick={() => {
    setShowAdminLogin(true);
    setShowCreateAccount(false);
    setShowForgotPin(false);
    setAdminError("");
  }}
>
  Administrator Login
</button>
            </form>
          )}

          <div className="login-footer">
            🪔 Every festival. Every contribution. Every memory.
          </div>
        </div>
      </div>
    );
  }

  if (showAppUsage) {
    const rows = analytics?.[analyticsPeriod] || [];
    const periodLabels = { daily: "Daily", monthly: "Monthly", yearly: "Yearly" };
    const latest = rows[0] || { visits: 0, unique_visitors: 0, logged_in_accounts: 0 };
    const chartRows = [...rows].slice(0, 12).reverse();
    const chartMax = Math.max(1, ...chartRows.map((row) => Number(row.visits || 0)));
    const chartPoints = chartRows.map((row, index) => ({
      x: chartRows.length === 1 ? 50 : 8 + (84 * index) / (chartRows.length - 1),
      y: 90 - (Number(row.visits || 0) / chartMax) * 72,
      period: row.period,
      visits: Number(row.visits || 0),
    }));
    const chartPath = chartPoints.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    ).join(" ");

    const usageButtonStyle = (active) => ({
      border: active ? "1px solid #f97316" : "1px solid #e5e7eb",
      background: active ? "#f97316" : "#ffffff",
      color: active ? "#ffffff" : "#374151",
      borderRadius: "10px",
      padding: "10px 16px",
      fontWeight: 600,
      cursor: "pointer",
    });
    const metricCardStyle = {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "14px",
      padding: "18px",
      display: "flex",
      alignItems: "center",
      gap: "14px",
      minWidth: 0,
      boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
    };

    return (
      <div className="app-page" style={{ background: "#f6f8fb", minHeight: "100vh", padding: "20px 16px" }}>
        <div className="container" style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <button className="back-btn" type="button" onClick={() => setShowAppUsage(false)}>
            ← Back to Dashboard
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", margin: "20px 0 24px" }}>
            <div>
              <h1 style={{ margin: 0, color: "#111827", fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 750 }}>
                📊 App Usage Analytics
              </h1>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>Track how your app is being used over time.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 14px", color: "#374151" }}>
              <span aria-hidden="true">▦</span>
              <span>Last 12 Months</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "18px" }}>
            <div style={metricCardStyle}>
              <div style={{ background: "#eff6ff", color: "#2563eb", borderRadius: "12px", padding: "14px", fontSize: "25px" }} aria-hidden="true">👥</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#64748b", fontSize: "14px" }}>Total Visits</div>
                <div style={{ color: "#111827", fontSize: "28px", fontWeight: 750 }}>{Number(latest.visits || 0).toLocaleString()}</div>
              </div>
              <div style={{ marginLeft: "auto", color: "#16a34a", background: "#f0fdf4", borderRadius: "8px", padding: "5px 8px", fontSize: "13px", whiteSpace: "nowrap" }}>↑ —</div>
            </div>
            <div style={metricCardStyle}>
              <div style={{ background: "#eff6ff", color: "#2563eb", borderRadius: "12px", padding: "14px", fontSize: "25px" }} aria-hidden="true">👤</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#64748b", fontSize: "14px" }}>Unique Visitors</div>
                <div style={{ color: "#111827", fontSize: "28px", fontWeight: 750 }}>{Number(latest.unique_visitors || 0).toLocaleString()}</div>
              </div>
              <div style={{ marginLeft: "auto", color: "#16a34a", background: "#f0fdf4", borderRadius: "8px", padding: "5px 8px", fontSize: "13px", whiteSpace: "nowrap" }}>↑ —</div>
            </div>
            <div style={metricCardStyle}>
              <div style={{ background: "#f5f3ff", color: "#7c3aed", borderRadius: "12px", padding: "14px", fontSize: "25px" }} aria-hidden="true">👥</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#64748b", fontSize: "14px" }}>Logged-in Accounts</div>
                <div style={{ color: "#111827", fontSize: "28px", fontWeight: 750 }}>{Number(latest.logged_in_accounts || 0).toLocaleString()}</div>
              </div>
              <div style={{ marginLeft: "auto", color: "#16a34a", background: "#f0fdf4", borderRadius: "8px", padding: "5px 8px", fontSize: "13px", whiteSpace: "nowrap" }}>↑ —</div>
            </div>
          </div>

          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "18px", marginBottom: "18px", boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, color: "#111827", fontSize: "20px" }}>App Usage Trend</h2>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {["daily", "monthly", "yearly"].map((period) => (
                  <button key={period} type="button" style={usageButtonStyle(analyticsPeriod === period)} onClick={() => setAnalyticsPeriod(period)}>
                    {periodLabels[period]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", color: "#64748b", fontSize: "13px", marginBottom: "12px" }}>
              <span><span style={{ color: "#3b82f6" }}>●</span> Visits</span>
              <span><span style={{ color: "#16a34a" }}>●</span> Unique Visitors</span>
              <span><span style={{ color: "#f97316" }}>●</span> Logged-in Accounts</span>
            </div>
            {analyticsLoading ? <p style={{ color: "#64748b" }}>Loading usage data…</p> : analyticsError ? (
              <p role="alert" style={{ color: "#b91c1c" }}>{analyticsError}</p>
            ) : chartPoints.length ? (
              <div style={{ width: "100%", overflow: "hidden" }}>
                <svg viewBox="0 0 100 100" role="img" aria-label={`Visits trend for ${periodLabels[analyticsPeriod].toLowerCase()} periods`} style={{ display: "block", width: "100%", height: "190px" }} preserveAspectRatio="none">
                  {[18, 42, 66, 90].map((y) => <line key={y} x1="6" y1={y} x2="94" y2={y} stroke="#e5e7eb" strokeWidth="0.5" />)}
                  {chartPoints.length > 1 && <path d={chartPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
                  {chartPoints.map((point) => <circle key={point.period} cx={point.x} cy={point.y} r="1.8" fill="#3b82f6"><title>{`${point.period}: ${point.visits} visits`}</title></circle>)}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "12px" }}>
                  <span>{chartPoints[0]?.period}</span><span>{chartPoints[chartPoints.length - 1]?.period}</span>
                </div>
                {chartPoints.length === 1 && <p style={{ color: "#64748b", fontSize: "13px", margin: "8px 0 0" }}>Only one period is available so far; more points will appear as usage data accumulates.</p>}
              </div>
            ) : <p style={{ color: "#64748b" }}>No usage data for this period yet.</p>}
          </section>

          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "18px", marginBottom: "18px", boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)" }}>
            <h2 style={{ margin: "0 0 14px", color: "#111827", fontSize: "20px" }}>Usage Data</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "560px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#374151" }}>
                    {["Period (UTC)", "Visits", "Unique visitors", "Logged-in accounts"].map((label) => <th key={label} style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", fontWeight: 650 }}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((row) => (
                    <tr key={row.period}>
                      <td style={{ padding: "12px", borderBottom: "1px solid #eef2f7", color: "#111827" }}>{row.period}</td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #eef2f7" }}>{Number(row.visits || 0).toLocaleString()}</td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #eef2f7" }}>{Number(row.unique_visitors || 0).toLocaleString()}</td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #eef2f7" }}>{Number(row.logged_in_accounts || 0).toLocaleString()}</td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ padding: "16px", color: "#64748b" }}>No usage data for this period yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "13px", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: "10px", padding: "10px 12px" }}>
              ⓘ Data is updated when refreshed. Times are in UTC.
            </p>
            <button type="button" className="secondary-btn" onClick={loadPublicAnalytics} disabled={analyticsLoading}>
              {analyticsLoading ? "Refreshing…" : "↻ Refresh Data"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     FESTIVAL DETAIL PAGE
  ======================================================= */

  if (selectedFestival) {
    const festival = selectedFestival;

    return (
      <div className="app-page">
        <div className="container">
          <button
            className="back-btn"
            onClick={() => setSelectedFestival(null)}
          >
            ← Back to Dashboard
          </button>

          {/* FESTIVAL HEADER */}

          <div className="festival-detail-header">
            <div className="festival-detail-info">
              <span className="detail-small-label">
                🪔 Festival Details
              </span>
              

              <h1>{festival.name}</h1>

              <p>
                {festival.date
                  ? `${festival.date} • ${festival.year}`
                  : festival.year}
              </p>

              {festival.description && (
                <div className="festival-description">
                  {festival.description}
                </div>
              )}

              <button
                type="button"
                className="small-primary-btn"
                style={{ marginTop: "8px", padding: "6px 12px", fontSize: "13px" }}
                onClick={() => {
                  setEditingFestivalId(festival.id);
                  setFestivalName(festival.name || "");
                  setFestivalYear(String(festival.year || new Date().getFullYear()));
                  setFestivalDate(parseDate(festival.date));
                  setFestivalDescription(festival.description || "");
                  setFestivalPhoto(null);
                  setFestivalPhotoPreview("");
                  setShowFestivalForm(true);
                }}
              >
                Edit
              </button>
            </div>

            <div className="detail-cover-photo-wrap">
              {festival.photo ? (
                <img
                  src={festival.photo}
                  alt={festival.name}
                  className="detail-cover-photo"
                />
              ) : (
                <div className="detail-photo-placeholder">🪔</div>
              )}
              <div className="photo-management-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                <label className="small-primary-btn upload-btn" htmlFor="replace-festival-cover">
                  {coverPhotoBusy ? "Working..." : festival.photo ? "Replace Cover Photo" : "Add Cover Photo"}
                </label>
                <input
                  id="replace-festival-cover"
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={coverPhotoBusy}
                  onChange={handleReplaceCoverPhoto}
                />
                {festival.photo && (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={coverPhotoBusy}
                    onClick={handleDeleteCoverPhoto}
                  >
                    Delete Cover Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          {showFestivalForm && editingFestivalId === festival.id && (
            <form className="content-card inline-form" onSubmit={handleAddFestival}>
              <h2>Edit Festival Details</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Festival Name</label>
                  <input
                    type="text"
                    value={festivalName}
                    onChange={(event) => setFestivalName(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <input
                    type="number"
                    min="1900"
                    max="2200"
                    value={festivalYear}
                    onChange={(event) => setFestivalYear(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Festival Date</label>
                  <DatePicker
                    selected={festivalDate}
                    onChange={setFestivalDate}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="DD/MM/YYYY"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    className="date-picker"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={festivalDescription}
                    onChange={(event) => setFestivalDescription(event.target.value)}
                    placeholder="Festival description"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    resetFestivalForm();
                    setShowFestivalForm(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="small-primary-btn" disabled={authSubmitting}>
                  {authSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}

          {/* MONEY SUMMARY */}

          <div className="stats-grid three-stats">
            <div className="stat-card">
              <span>💰Total Collection</span>

              <strong>
                ₹
                {selectedCollectionTotal.toLocaleString("en-IN")}
              </strong>
            </div>

            <div className="stat-card">
              <span>💸Total Expenses</span>

              <strong>
                ₹{selectedExpenseTotal.toLocaleString("en-IN")}
              </strong>
            </div>

            <div className="stat-card">
              <span>💵Remaining Balance</span>

              <strong>
                ₹{selectedBalance.toLocaleString("en-IN")}
              </strong>
            </div>
          </div>

          {/* =================================================
              COLLECTIONS
          ================================================= */}

          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>💰Collections</h2>

                <p>
                  Track every contribution received for this
                  festival.
                </p>
              </div>

              <button
                className="small-primary-btn"
                onClick={() => {
                  resetCollectionForm();
                  setShowCollectionForm(true);
                }}
              >
                + Add Collection
              </button>
            </div>

            {showCollectionForm && (
              <form
                className="inline-form"
                onSubmit={handleSaveCollection}
              >
                <h3>
                  {editingCollectionId
                    ? "Edit Collection"
                    : "Add Collection"}
                </h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Name</label>

                    <input
                      type="text"
                      placeholder="Enter name"
                      value={collectionName}
                      onChange={(event) =>
                        setCollectionName(event.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone No</label>

                    <input
                      type="tel"
                      placeholder="Enter phone number"
                      value={collectionPhone}
                      onChange={(event) =>
                        setCollectionPhone(event.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Date</label>

                    <DatePicker
                      selected={collectionDate}
                      onChange={(date) =>
                        setCollectionDate(date)
                      }
                      dateFormat="dd/MM/yyyy"
                      placeholderText="DD/MM/YYYY"
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      className="date-picker"
                    />
                  </div>

                  <div className="form-group">
                    <label>Amount (₹)</label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter amount"
                      value={collectionAmount}
                      onChange={(event) =>
                        setCollectionAmount(event.target.value)
                      }
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Notes</label>

                    <textarea
                      placeholder="Optional notes"
                      value={collectionNotes}
                      onChange={(event) =>
                        setCollectionNotes(event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      resetCollectionForm();
                      setShowCollectionForm(false);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="small-primary-btn"
                    disabled={authSubmitting}
                  >
                    {authSubmitting
                      ? "Saving..."
                      : editingCollectionId
                        ? "Update Collection"
                        : "Save Collection"}
                  </button>
                </div>
              </form>
            )}

            {festival.collections?.length ? (
              <div className="table-wrapper">
                <table className="center-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Name</th>
                      <th>Phone No</th>
                      <th>Date</th>
                      <th>Amount (₹)</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {festival.collections.map(
                      (collection, index) => (
                        <tr key={collection.id}>
                          <td>{index + 1}</td>

                          <td className="strong-cell">
                            {collection.name}
                          </td>

                          <td>{collection.phone || "—"}</td>

                          <td>{collection.date || "—"}</td>

                          <td className="amount-cell">
                            ₹
                            {Number(
                              collection.amount || 0
                            ).toLocaleString("en-IN")}
                          </td>

                          <td>{collection.notes || "—"}</td>

                          <td>
                            <button
                              className="edit-btn"
                              onClick={() =>
                                handleEditCollection(collection)
                              }
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td
                        colSpan="4"
                        className="total-label"
                      >
                        Total Collection
                      </td>

                      <td
                        className="total-value"
                        colSpan="3"
                      >
                        ₹
                        {selectedCollectionTotal.toLocaleString(
                          "en-IN"
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">💰</div>

                <h3>No collections yet</h3>

                <p>
                  Add the first contribution for this festival.
                </p>
              </div>
            )}
          </div>

          {/* =================================================
              EXPENSES
          ================================================= */}

          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>💸Expenses</h2>

                <p>
                  Track all expenses made for this festival.
                </p>
              </div>

              <button
                className="small-primary-btn"
                onClick={() => {
                  resetExpenseForm();
                  setShowExpenseForm(true);
                }}
              >
                + Add Expense
              </button>
            </div>

            {showExpenseForm && (
              <form
                className="inline-form"
                onSubmit={handleSaveExpense}
              >
                <h3>
                  {editingExpenseId
                    ? "Edit Expense"
                    : "Add Expense"}
                </h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Name</label>

                    <input
                      type="text"
                      placeholder="Expense name"
                      value={expenseName}
                      onChange={(event) =>
                        setExpenseName(event.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Date</label>

                    <DatePicker
                      selected={expenseDate}
                      onChange={(date) =>
                        setExpenseDate(date)
                      }
                      dateFormat="dd/MM/yyyy"
                      placeholderText="DD/MM/YYYY"
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      className="date-picker"
                    />
                  </div>

                  <div className="form-group">
                    <label>Amount (₹)</label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter amount"
                      value={expenseAmount}
                      onChange={(event) =>
                        setExpenseAmount(event.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Notes</label>

                    <input
                      type="text"
                      placeholder="Optional notes"
                      value={expenseNotes}
                      onChange={(event) =>
                        setExpenseNotes(event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      resetExpenseForm();
                      setShowExpenseForm(false);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="small-primary-btn"
                    disabled={authSubmitting}
                  >
                    {authSubmitting
                      ? "Saving..."
                      : editingExpenseId
                        ? "Update Expense"
                        : "Save Expense"}
                  </button>
                </div>
              </form>
            )}

            {festival.expenses?.length ? (
              <div className="table-wrapper">
                <table className="center-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Amount (₹)</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {festival.expenses.map((expense, index) => (
                      <tr key={expense.id}>
                        <td>{index + 1}</td>

                        <td className="strong-cell">
                          {expense.name}
                        </td>

                        <td>{expense.date || "—"}</td>

                        <td className="amount-cell">
                          ₹
                          {Number(
                            expense.amount || 0
                          ).toLocaleString("en-IN")}
                        </td>

                        <td>{expense.notes || "—"}</td>

                        <td>
                          <button
                            className="edit-btn"
                            onClick={() =>
                              handleEditExpense(expense)
                            }
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td
                        colSpan="3"
                        className="total-label"
                      >
                        Total Expenses
                      </td>

                      <td
                        className="total-value"
                        colSpan="3"
                      >
                        ₹
                        {selectedExpenseTotal.toLocaleString(
                          "en-IN"
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">💸</div>

                <h3>No expenses yet</h3>

                <p>
                  Add expenses to keep your festival accounts
                  accurate.
                </p>
              </div>
            )}
          </div>

          {/* =================================================
              FESTIVAL MEMORIES
          ================================================= */}

          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>📸Festival Memories</h2>

                <p>
                  Save photos and memories from this festival.
                </p>
              </div>

              <label
                className="small-primary-btn upload-btn"
                htmlFor="memory-upload"
              >
                + Add Photos
              </label>

              <input
                id="memory-upload"
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleMemoryPhotoChange}
              />
            </div>

            {memoryPhotos.length > 0 && (
              <div className="inline-form">
                <h3>
                  {memoryPhotos.length} photo
                  {memoryPhotos.length > 1 ? "s" : ""} selected
                </h3>

                <div className="memory-gallery">
                  {memoryPhotos.map((file, index) => (
                    <div
                      className="memory-photo"
                      key={`${file.name}-${index}`}
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Selected memory"
                      />
                    </div>
                  ))}
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setMemoryPhotos([])}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="small-primary-btn"
                    onClick={handleUploadMemories}
                    disabled={memoryUploading}
                  >
                    {memoryUploading
                      ? "Uploading..."
                      : "Upload Memories"}
                  </button>
                </div>
              </div>
            )}

            {festival.memories?.length ? (
              <div className="memory-gallery">
                {festival.memories.map((memory) => (
                  <div
                    className="memory-photo memory-photo-managed"
                    key={memory.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignSelf: "start",
                      height: "auto",
                      minHeight: 0,
                      overflow: "visible",
                      position: "relative",
                    }}
                  >
                    <img
                      src={memory.imageUrl}
                      alt="Festival memory"
                      style={{
                        display: "block",
                        position: "static",
                        width: "100%",
                        height: "auto",
                        maxHeight: "none",
                        objectFit: "contain",
                        flex: "0 0 auto",
                      }}
                    />
                    <div
                      className="memory-photo-actions"
                      style={{
                        display: "flex",
                        visibility: "visible",
                        opacity: 1,
                        position: "static",
                        zIndex: 2,
                        width: "100%",
                        boxSizing: "border-box",
                        flex: "0 0 auto",
                        gap: "8px",
                        flexWrap: "wrap",
                        padding: "10px",
                        background: "#fff7ed",
                        borderTop: "1px solid #fed7aa",
                      }}
                    >
                      <label
                        htmlFor={`replace-memory-${memory.id}`}
                        aria-disabled={memoryActionId === memory.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: memoryActionId === memory.id ? "not-allowed" : "pointer",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          background: "#2563eb",
                          color: "#ffffff",
                          fontWeight: 600,
                          lineHeight: 1.4,
                        }}
                      >
                        {memoryActionId === memory.id ? "Working..." : "Replace"}
                      </label>
                      <input
                        id={`replace-memory-${memory.id}`}
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={memoryActionId === memory.id}
                        onChange={(event) => handleReplaceMemoryPhoto(memory, event)}
                      />
                      <button
                        type="button"
                        disabled={memoryActionId === memory.id}
                        onClick={() => handleDeleteMemoryPhoto(memory)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          background: "#b91c1c",
                          color: "#ffffff",
                          fontWeight: 600,
                          lineHeight: 1.4,
                          border: 0,
                          cursor: memoryActionId === memory.id ? "not-allowed" : "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !memoryPhotos.length ? (
              <div className="empty-state">
                <div className="empty-icon">📸</div>

                <h3>No memories yet</h3>

                <p>
                  Upload photos to preserve your festival
                  memories.
                </p>
              </div>
            ) : null}
          </div>

          {/* =================================================
              WINNER / DISTRIBUTION
          ================================================= */}

          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>🏆Winner / Distribution</h2>

                <p>
                  Record winners, prizes and distributions.
                </p>
              </div>

              <button
                className="small-primary-btn"
                onClick={() => {
                  resetDistributionForm();
                  setShowDistributionForm(true);
                }}
              >
                + Add Distribution
              </button>
            </div>

            {showDistributionForm && (
              <form
                className="inline-form"
                onSubmit={handleSaveDistribution}
              >
                <h3>
                  {editingDistributionId
                    ? "Edit Winner / Distribution"
                    : "Add Winner / Distribution"}
                </h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Name</label>

                    <input
                      type="text"
                      placeholder="Enter name"
                      value={distributionName}
                      onChange={(event) =>
                        setDistributionName(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Date</label>

                    <DatePicker
                      selected={distributionDate}
                      onChange={(date) =>
                        setDistributionDate(date)
                      }
                      dateFormat="dd/MM/yyyy"
                      placeholderText="DD/MM/YYYY"
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      className="date-picker"
                    />
                  </div>

                  <div className="form-group">
                    <label>Items</label>

                    <input
                      type="text"
                      placeholder="Prize / items"
                      value={distributionItems}
                      onChange={(event) =>
                        setDistributionItems(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone No</label>

                    <input
                      type="tel"
                      placeholder="Enter phone number"
                      value={distributionPhone}
                      onChange={(event) =>
                        setDistributionPhone(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Amount (₹)</label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter amount"
                      value={distributionAmount}
                      onChange={(event) =>
                        setDistributionAmount(
                          event.target.value
                        )
                      }
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      resetDistributionForm();
                      setShowDistributionForm(false);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="small-primary-btn"
                    disabled={authSubmitting}
                  >
                    {authSubmitting
                      ? "Saving..."
                      : editingDistributionId
                        ? "Update"
                        : "Save Distribution"}
                  </button>
                </div>
              </form>
            )}

            {festival.distributions?.length ? (
              <div className="table-wrapper">
                <table className="center-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Phone No</th>
                      <th>Amount (₹)</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {festival.distributions.map(
                      (distribution, index) => (
                        <tr key={distribution.id}>
                          <td>{index + 1}</td>

                          <td className="strong-cell">
                            {distribution.name}
                          </td>

                          <td>
                            {distribution.date || "—"}
                          </td>

                          <td>
                            {distribution.items || "—"}
                          </td>

                          <td>
                            {distribution.phone || "—"}
                          </td>

                          <td className="amount-cell">
                            ₹
                            {Number(
                              distribution.amount || 0
                            ).toLocaleString("en-IN")}
                          </td>

                          <td>
                            <button
                              className="edit-btn"
                              onClick={() =>
                                handleEditDistribution(
                                  distribution
                                )
                              }
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🏆</div>

                <h3>No winner or distribution records</h3>

                <p>
                  Add winner and prize distribution details
                  here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     DASHBOARD
  ======================================================= */

  return (
    <div className="app-page">
      <div className="container">
        <header className="top-header">
          <div>
            <div className="dashboard-label">
              🪔 Festival Connect
            </div>

            <h1>Welcome, {villageName}</h1>

            <p>Manage your village festival records</p>
            {editingVillageName ? (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                <input aria-label="Village name" value={villageNameDraft}
                  onChange={e=>setVillageNameDraft(e.target.value)} />
                <button className="primary-btn" type="button" onClick={handleSaveVillageName}>Save</button>
                <button className="secondary-btn" type="button" onClick={()=>setEditingVillageName(false)}>Cancel</button>
              </div>
            ) : (
              <button className="secondary-btn" type="button" style={{marginTop:8}}
                onClick={()=>{setVillageNameDraft(villageName);setEditingVillageName(true);}}>Edit village name</button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}

          >
           <button className="primary-btn" type="button" onClick={() => { resetFestivalForm(); setShowFestivalForm(true); }}>
              + Add Festival
            </button>

            <button className="secondary-btn" type="button" onClick={() => { setShowAppUsage(true); loadPublicAnalytics(); }}>
              📊 App Usage
            </button>

            <button className="secondary-btn" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {/* =================================================
            DASHBOARD STATS
        ================================================= */}

        <div className="stats-grid">
          <div className="stat-card">
            <span>💰 Collection</span>

            <strong>
              ₹{totalCollection.toLocaleString("en-IN")}
            </strong>
          </div>

          <div className="stat-card">
            <span>💸 Expenses</span>

            <strong>
              ₹{totalExpenses.toLocaleString("en-IN")}
            </strong>
          </div>

          <div className="stat-card">
            <span>💵 Remaining Balance</span>

            <strong>
              ₹{remainingBalance.toLocaleString("en-IN")}
            </strong>
          </div>

          <div className="stat-card">
            <span>🎉 Total Festivals</span>

            <strong>{festivals.length}</strong>
          </div>
        </div>

        {/* =================================================
            ADD FESTIVAL
        ================================================= */}

        {showFestivalForm && (
          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>Add Festival</h2>

                <p>
                  Create a permanent festival record for your
                  village.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddFestival}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Festival Name</label>

                  <input
                    type="text"
                    placeholder="Enter festival name"
                    value={festivalName}
                    onChange={(event) =>
                      setFestivalName(event.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Year</label>

                  <input
                    type="number"
                    min="1900"
                    max="2200"
                    placeholder="Enter year"
                    value={festivalYear}
                    onChange={(event) =>
                      setFestivalYear(event.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Festival Date</label>

                  <DatePicker
                    selected={festivalDate}
                    onChange={(date) =>
                      setFestivalDate(date)
                    }
                    dateFormat="dd/MM/yyyy"
                    placeholderText="DD/MM/YYYY"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    className="date-picker"
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>

                  <input
                    type="text"
                    placeholder="Short festival description"
                    value={festivalDescription}
                    onChange={(event) =>
                      setFestivalDescription(
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group full-width">
                  <label>Festival Photo</label>

                  <div className="festival-photo-upload">
                    {!festivalPhotoPreview ? (
                      <label
                        className="photo-placeholder"
                        htmlFor="festival-photo"
                      >
                        <span>📸</span>

                        <strong>
                          Click to upload festival photo
                        </strong>

                        <small>
                          JPG, PNG, WEBP • Maximum 6 MB
                        </small>
                      </label>
                    ) : (
                      <div className="selected-cover-photo">
                        <img
                          src={festivalPhotoPreview}
                          alt="Festival preview"
                        />

                        <label
                          className="change-photo-btn"
                          htmlFor="festival-photo"
                        >
                          Change Photo
                        </label>
                      </div>
                    )}

                    <input
                      id="festival-photo"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleFestivalPhotoChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    resetFestivalForm();
                    setShowFestivalForm(false);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={authSubmitting}
                >
                  {authSubmitting
                    ? "Saving..."
                    : "Save Festival"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================
            FESTIVAL HISTORY
        ================================================= */}

        <section className="history-section">
          <div className="section-title-row">
            <div>
              <h2>Festival History</h2>

              <p>
                Your village festival records and memories.
              </p>
            </div>
          </div>

          {festivals.length ? (
            <div className="festival-list">
              {festivals.map((festival) => {
                const festivalCollection =
                  festival.collections?.reduce(
                    (sum, item) =>
                      sum + Number(item.amount || 0),
                    0
                  ) || 0;

                const festivalExpense =
                  festival.expenses?.reduce(
                    (sum, item) =>
                      sum + Number(item.amount || 0),
                    0
                  ) || 0;

                return (
                  <div
                    className="festival-card"
                    key={festival.id}
                  >
                    <div className="festival-card-photo">
                      {festival.photo ? (
                        <img
                          src={festival.photo}
                          alt={festival.name}
                        />
                      ) : (
                        <div className="photo-empty">
                          🪔
                        </div>
                      )}
                    </div>

                    <div className="festival-main-info">
                      <h3>{festival.name}</h3>

                      <p>
                        {festival.date
                          ? `${festival.date} • `
                          : ""}
                        {festival.year}
                      </p>
                    </div>

                    <div className="festival-money">
                      <span>💰 Collection</span>

                      <strong>
                        ₹
                        {festivalCollection.toLocaleString(
                          "en-IN"
                        )}
                      </strong>
                    </div>

                    <div className="festival-money">
                      <span>💸 Expenses</span>

                      <strong>
                        ₹
                        {festivalExpense.toLocaleString(
                          "en-IN"
                        )}
                      </strong>
                    </div>

                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <button type="button" className="view-btn"
                        onClick={() => setSelectedFestival(festival)}>View</button>
                      <button type="button" className="secondary-btn"
                        onClick={() => handleDeleteFestival(festival)}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="content-card empty-history">
              <div className="empty-state">
                <div className="empty-icon">🪔</div>

                <h3>No festivals added yet</h3>

                <p>
                  Click “+ Add Festival” to create your first
                  village festival record.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
