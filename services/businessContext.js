const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/* =========================================================
   GET BUSINESS CONTEXT BY USER ID
========================================================= */

async function getBusinessContext(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const {
    data: business,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (businessError) {
    console.error(
      "AI BUSINESS QUERY ERROR:",
      businessError
    );

    throw new Error(
      "Could not load business information."
    );
  }

  if (!business) {
    throw new Error(
      "No business information found for this account."
    );
  }

  const {
    data: items,
    error: itemsError,
  } = await supabase
    .from("business_items")
    .select(
      "id, name, price, description"
    )
    .eq(
      "business_id",
      business.id
    )
    .order("created_at", {
      ascending: true,
    });

  if (itemsError) {
    console.error(
      "AI ITEMS QUERY ERROR:",
      itemsError
    );

    throw new Error(
      "Could not load business products and services."
    );
  }

  return {
    business: {
      id: business.id,
      name: business.name || "",
      category: business.category || "",
      location: business.location || "",
      phone: business.phone || "",
      email: business.email || "",
      website: business.website || "",

      openingTime:
        business.opening_time || "",

      closingTime:
        business.closing_time || "",

      mainInfo:
        business.main_info || "",

      customInfo:
        business.custom_info || "",
    },

    items: (items || []).map(
      (item) => ({
        id: item.id,
        name: item.name || "",
        price:
          item.price !== null &&
          item.price !== undefined
            ? item.price
            : "",
        description:
          item.description || "",
      })
    ),
  };
}

/* =========================================================
   GET BUSINESS CONTEXT BY BUSINESS ID
========================================================= */

async function getBusinessContextByBusinessId(
  businessId
) {
  if (!businessId) {
    throw new Error(
      "Business ID is required."
    );
  }

  const {
    data: business,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) {
    console.error(
      "WIDGET BUSINESS QUERY ERROR:",
      businessError
    );

    throw new Error(
      "Could not load business information."
    );
  }

  if (!business) {
    throw new Error(
      "Business information not found."
    );
  }

  const {
    data: items,
    error: itemsError,
  } = await supabase
    .from("business_items")
    .select(
      "id, name, price, description"
    )
    .eq(
      "business_id",
      businessId
    )
    .order("created_at", {
      ascending: true,
    });

  if (itemsError) {
    console.error(
      "WIDGET ITEMS QUERY ERROR:",
      itemsError
    );

    throw new Error(
      "Could not load business products and services."
    );
  }

  console.log(
    "AI CONTEXT READY:",
    {
      businessId:
        business.id,
      businessName:
        business.name,
      itemsCount:
        items?.length || 0,
    }
  );

  return {
    business: {
      id: business.id,
      name: business.name || "",
      category: business.category || "",
      location: business.location || "",
      phone: business.phone || "",
      email: business.email || "",
      website: business.website || "",

      openingTime:
        business.opening_time || "",

      closingTime:
        business.closing_time || "",

      mainInfo:
        business.main_info || "",

      customInfo:
        business.custom_info || "",
    },

    items: (items || []).map(
      (item) => ({
        id: item.id,
        name: item.name || "",
        price:
          item.price !== null &&
          item.price !== undefined
            ? item.price
            : "",
        description:
          item.description || "",
      })
    ),
  };
}

module.exports = {
  getBusinessContext,
  getBusinessContextByBusinessId,
};
