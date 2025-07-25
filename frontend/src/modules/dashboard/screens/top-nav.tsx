import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/atoms/dropdown-menu"
import { Bell, ChevronRight, ImageDownIcon } from "lucide-react"
import Profile01 from "./profile-01" 
import { Link } from "react-router"

interface BreadcrumbItem {
  label: string
  href?: string
}

export default function TopNav() {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "SkillCheck", href: "#" },
    { label: "dashboard", href: "#" },
  ];

  return (
    <nav className="px-3 sm:px-6 flex items-center justify-between bg-white border-b border-gray-200 h-full">
      <div className="font-medium text-sm hidden sm:flex items-center space-x-1 truncate max-w-[300px]">
        {breadcrumbs.map((item, index) => (
          <div key={item.label} className="flex items-center">
            {index > 0 && <ChevronRight className="h-4 w-4 text-gray-500 mx-1" />}
            {item.href ? (
              <Link
                to={item.href}
                className="text-gray-700 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-900">{item.label}</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 sm:gap-4 ml-auto sm:ml-0">
        <button
          type="button"
          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
        </button> 
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <ImageDownIcon className="h-4 w-4 text-gray-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-[280px] sm:w-80 bg-background border-border rounded-lg shadow-lg"
          >
            <Profile01 avatar="https://ferf1mheo22r9ira.public.blob.vercel-storage.com/avatar-01-n0x8HFv8EUetf9z6ht0wScJKoTHqf8.png" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
