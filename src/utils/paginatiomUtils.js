import { ref } from 'vue'

export const usePagination = (listResponse) => {
  const paginationOptions = ref([3, 10, 20, 40])
  const paginationModel = ref(10)
  const currentPagination = ref(1)
  const currentResultPageList = ref([])
  const currentPagesNum = ref(1)

  const handlePagination = () => {
    const resultNum = listResponse.value.length
    const perPage = parseInt(paginationModel.value)

    if (resultNum <= paginationModel.value) {
      currentResultPageList.value = listResponse.value
      currentPagesNum.value = 1
    }
    if (resultNum > paginationModel.value) {
      const startIndex = (currentPagination.value - 1) * perPage
      const endIndex = currentPagination.value * perPage

      currentResultPageList.value = listResponse.value.slice(startIndex, endIndex)
      currentPagesNum.value = Math.ceil(resultNum / perPage)
    }
  }

  return {
    paginationOptions,
    paginationModel,
    currentPagination,
    currentResultPageList,
    currentPagesNum,
    handlePagination
  }
}
